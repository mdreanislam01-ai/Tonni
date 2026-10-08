package online.rmfbd.tonni;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Loopback-only HTTP endpoint that lets the WebView hand a finished file (a
 * recorded call, a received attachment) to the phone's Download folder.
 *
 * A WebView cannot create browser downloads: clicking an {@code <a download>}
 * anchor that points at a {@code blob:} URL is a no-op unless the app installs
 * its own download bridge, and blob data cannot be fetched from the native
 * side. Rather than pushing whole videos through the JavaScript bridge as
 * base64 strings (which would balloon memory), the page POSTs the bytes to this
 * receiver on {@code http://127.0.0.1:<port>/save} and they are streamed
 * straight to disk.
 *
 * The socket binds to the loopback interface on an ephemeral port, the request
 * size is capped, and the filename is sanitised, so nothing outside the app can
 * reach it.
 */
final class LocalFileReceiver {

    private static final String TAG = "TonniFileReceiver";
    private static final int MAX_HEADER_BYTES = 16 * 1024;
    private static final long MAX_BODY_BYTES = 1024L * 1024L * 1024L; // 1 GB
    private static final String FOLDER = "Tonni";

    private final Context context;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ServerSocket serverSocket;
    private ExecutorService workers;
    private Thread acceptThread;
    private int port = -1;

    LocalFileReceiver(Context context) {
        this.context = context.getApplicationContext();
    }

    boolean isRunning() {
        return running.get() && port > 0;
    }

    int getPort() {
        return port;
    }

    /** Binds the loopback socket. Throws only if the port cannot be opened. */
    void start() throws IOException {
        serverSocket = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        port = serverSocket.getLocalPort();
        running.set(true);
        workers = Executors.newFixedThreadPool(2);
        acceptThread = new Thread(this::acceptLoop, "tonni-file-receiver");
        acceptThread.setDaemon(true);
        acceptThread.start();
        Log.i(TAG, "Saving recordings to Downloads through 127.0.0.1:" + port);
    }

    void stop() {
        running.set(false);
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
            // closing a socket that is already gone is fine
        }
        if (workers != null) workers.shutdownNow();
    }

    private void acceptLoop() {
        while (running.get()) {
            try {
                Socket socket = serverSocket.accept();
                workers.execute(() -> {
                    try {
                        handle(socket);
                    } catch (Throwable error) {
                        Log.w(TAG, "Request failed", error);
                    } finally {
                        try {
                            socket.close();
                        } catch (IOException ignored) {
                            // nothing else to do
                        }
                    }
                });
            } catch (IOException error) {
                if (running.get()) Log.w(TAG, "accept() failed", error);
            } catch (Throwable error) {
                Log.w(TAG, "accept loop stopped", error);
                return;
            }
        }
    }

    private void handle(Socket socket) throws IOException {
        InputStream rawIn = new BufferedInputStream(socket.getInputStream());
        OutputStream rawOut = new BufferedOutputStream(socket.getOutputStream());

        String requestLine = readLine(rawIn);
        if (requestLine == null) return;
        String[] parts = requestLine.split(" ");
        String method = parts.length > 0 ? parts[0].toUpperCase(Locale.US) : "";
        String target = parts.length > 1 ? parts[1] : "/";

        long contentLength = -1;
        String filename = "";
        String mime = "";
        while (true) {
            String line = readLine(rawIn);
            if (line == null || line.isEmpty()) break;
            int colon = line.indexOf(':');
            if (colon <= 0) continue;
            String key = line.substring(0, colon).trim().toLowerCase(Locale.US);
            String value = line.substring(colon + 1).trim();
            if ("content-length".equals(key)) {
                try {
                    contentLength = Long.parseLong(value);
                } catch (NumberFormatException ignored) {
                    contentLength = -1;
                }
            } else if ("x-tonni-filename".equals(key)) {
                filename = decode(value);
            } else if ("content-type".equals(key)) {
                mime = value;
            }
        }

        if ("OPTIONS".equals(method)) {
            writeResponse(rawOut, 204, "{\"ok\":true}");
            return;
        }

        if (!"POST".equals(method) || !target.startsWith("/save")) {
            writeResponse(rawOut, 404, "{\"ok\":false,\"error\":\"not found\"}");
            return;
        }

        if (contentLength <= 0 || contentLength > MAX_BODY_BYTES) {
            writeResponse(rawOut, 413, "{\"ok\":false,\"error\":\"unsupported size\"}");
            return;
        }

        String safeName = sanitiseFilename(filename.isEmpty() ? "you-and-me-file" : filename, mime);
        try {
            String saved = saveStream(context, rawIn, contentLength, safeName, mime);
            writeResponse(rawOut, 200, "{\"ok\":true,\"path\":\"" + saved.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}");
        } catch (Throwable error) {
            Log.w(TAG, "Could not save " + safeName, error);
            writeResponse(rawOut, 500, "{\"ok\":false,\"error\":\"save failed\"}");
        }
    }

    /** Reads one CRLF terminated line, refusing to buffer more than one header block. */
    private String readLine(InputStream in) throws IOException {
        StringBuilder builder = new StringBuilder();
        int value;
        while ((value = in.read()) != -1) {
            if (value == '\n') break;
            if (value != '\r') builder.append((char) value);
            if (builder.length() > MAX_HEADER_BYTES) break;
        }
        if (value == -1 && builder.length() == 0) return null;
        return builder.toString();
    }

    private void writeResponse(OutputStream out, int status, String body) throws IOException {
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : status == 204 ? "No Content" : "Error") + "\r\n"
            + "Access-Control-Allow-Origin: *\r\n"
            + "Access-Control-Allow-Methods: POST, OPTIONS\r\n"
            + "Access-Control-Allow-Headers: Content-Type, X-Tonni-Filename\r\n"
            + "Access-Control-Max-Age: 600\r\n"
            + "Content-Type: application/json; charset=utf-8\r\n"
            + "Content-Length: " + (status == 204 ? 0 : payload.length) + "\r\n"
            + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        if (status != 204) out.write(payload);
        out.flush();
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, "UTF-8");
        } catch (Throwable error) {
            return value;
        }
    }

    static String sanitiseFilename(String name, String mime) {
        String base = name.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) base = base.substring(slash + 1);
        base = base.replaceAll("[^A-Za-z0-9._()\\- ]", "_").trim();
        if (base.isEmpty()) base = "you-and-me-file";
        if (base.length() > 120) {
            String extension = MimeTypeMap.getFileExtensionFromUrl(base);
            base = base.substring(0, 120) + (extension.isEmpty() ? "" : "." + extension);
        }
        if (!base.contains(".")) {
            String extension = extensionForMime(mime);
            if (!extension.isEmpty()) base = base + "." + extension;
        }
        return base;
    }

    static String extensionForMime(String mime) {
        if (mime == null) return "";
        String clean = mime.split(";")[0].trim().toLowerCase(Locale.US);
        if (clean.endsWith("mp4")) return "mp4";
        if (clean.endsWith("webm")) return "webm";
        if (clean.endsWith("quicktime")) return "mov";
        if (clean.endsWith("mpeg")) return "mp3";
        if (clean.endsWith("wav")) return "wav";
        if (clean.endsWith("ogg")) return "ogg";
        if (clean.endsWith("png")) return "png";
        if (clean.endsWith("jpeg") || clean.endsWith("jpg")) return "jpg";
        if (clean.endsWith("pdf")) return "pdf";
        String fromMap = MimeTypeMap.getSingleton().getExtensionFromMimeType(clean);
        return fromMap == null ? "" : fromMap;
    }

    /**
     * Streams {@code length} bytes into the public Downloads folder. On Android
     * 10+ this goes through MediaStore (no permission required); older releases
     * fall back to the app-specific downloads folder, which also needs no
     * permission. Returns a human readable location.
     */
    static String saveStream(Context context, InputStream in, long length, String filename, String mimeType) throws IOException {
        String type = (mimeType == null || mimeType.isEmpty() || mimeType.startsWith("application/octet-stream"))
            ? guessMime(filename)
            : mimeType.split(";")[0].trim();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, type);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (item == null) throw new IOException("MediaStore refused the download entry");

            boolean complete = false;
            try (OutputStream out = resolver.openOutputStream(item)) {
                if (out == null) throw new IOException("MediaStore returned no stream");
                copy(in, out, length);
                complete = true;
            } finally {
                if (!complete) resolver.delete(item, null, null);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(item, values, null, null);
            return Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER + "/" + filename;
        }

        File directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) directory = context.getFilesDir();
        File folder = new File(directory, FOLDER);
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Could not create " + folder);
        File target = new File(folder, filename);
        try (OutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
            copy(in, out, length);
        }
        return target.getAbsolutePath();
    }

    /** Decodes a {@code data:} URL (used by download-attribute links) to bytes. */
    static byte[] decodeDataUrl(String url) {
        int comma = url.indexOf(',');
        if (comma < 0) return null;
        String meta = url.substring(5, comma);
        String payload = url.substring(comma + 1);
        try {
            if (meta.toLowerCase(Locale.US).contains(";base64")) {
                return Base64.decode(payload, Base64.DEFAULT);
            }
            return decode(payload).getBytes(StandardCharsets.UTF_8);
        } catch (Throwable error) {
            Log.w(TAG, "Could not decode data URL", error);
            return null;
        }
    }

    static String mimeFromDataUrl(String url) {
        int colon = url.indexOf(':');
        int comma = url.indexOf(',');
        if (colon < 0 || comma < 0 || comma < colon) return "";
        String meta = url.substring(colon + 1, comma);
        int semicolon = meta.indexOf(';');
        return (semicolon >= 0 ? meta.substring(0, semicolon) : meta).trim();
    }

    static String nameFromDisposition(String contentDisposition, String url, String mime) {
        String guessed = null;
        if (contentDisposition != null && !contentDisposition.isEmpty()) {
            guessed = URLUtil.guessFileName(url, contentDisposition, mime);
        }
        if (guessed == null || guessed.isEmpty() || "downloadfile.bin".equals(guessed)) {
            guessed = "you-and-me-" + System.currentTimeMillis() + (extensionForMime(mime).isEmpty() ? "" : "." + extensionForMime(mime));
        }
        return sanitiseFilename(guessed, mime);
    }

    private static String guessMime(String filename) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(filename.replace(" ", "_"));
        String type = extension.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase(Locale.US));
        return type == null ? "application/octet-stream" : type;
    }

    private static void copy(InputStream in, OutputStream out, long length) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long remaining = length;
        while (remaining > 0) {
            int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read == -1) break;
            out.write(buffer, 0, read);
            remaining -= read;
        }
        out.flush();
    }
}
