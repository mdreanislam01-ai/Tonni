package online.rmfbd.tonni;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayInputStream;

/**
 * Tonni ("You and Me") Android shell.
 *
 * The product itself is the Capacitor WebView that loads the Vite bundle from
 * the bundled asset server (https://localhost). This class only adds the pieces
 * a browser would otherwise provide for free:
 *
 *  1. Hardware / gesture back. The web UI owns its navigation state (modals,
 *     open chat, settings), so back is offered to the page first through the
 *     `tonni:back` event. The page answers synchronously by writing
 *     `window.__tonniBackHandled`, and the activity only finishes when the page
 *     reports that it had nothing left to close.
 *  2. Saving files. A WebView has no download manager, so recorded calls and
 *     downloaded attachments go through {@link LocalFileReceiver}: the page
 *     POSTs the bytes to a loopback socket which streams them into the phone's
 *     Download folder. The receiver address is published to the page as
 *     `window.TonniNative.saveEndpoint()`.
 *  3. `data:` links (attachment cards) and external links, handled through a
 *     download listener.
 *
 * Signing: APKs produced by the "Build Android APK" workflow are debug builds
 * signed with the throw-away keystore Gradle generates on the build machine.
 * They install straight onto a phone but must not be published to Google Play —
 * add a release keystore before shipping to a store.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "TonniMainActivity";
    private LocalFileReceiver fileReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            attachNativeDownloads(webView);
        } else {
            Log.w(TAG, "No WebView available; native file saving is disabled");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView view = getBridge() != null ? getBridge().getWebView() : null;
                if (view == null) {
                    closeActivity();
                    return;
                }

                if (view.canGoBack()) {
                    view.goBack();
                    return;
                }

                // The listener runs synchronously, so the flag is final by the
                // time the JS callback returns.
                view.evaluateJavascript(
                    "(function () { window.__tonniBackHandled = false;"
                        + " window.dispatchEvent(new Event('tonni:back'));"
                        + " return window.__tonniBackHandled === true; })()",
                    handled -> {
                        if (!"true".equals(handled)) closeActivity();
                    }
                );
            }
        });
    }

    private void closeActivity() {
        finish();
    }

    private void attachNativeDownloads(WebView webView) {
        try {
            LocalFileReceiver receiver = new LocalFileReceiver(getApplicationContext());
            receiver.start();
            fileReceiver = receiver;
        } catch (Throwable error) {
            Log.w(TAG, "Local save receiver unavailable; falling back to browser behaviour", error);
            fileReceiver = null;
        }

        try {
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String saveEndpoint() {
                    LocalFileReceiver receiver = fileReceiver;
                    if (receiver == null || !receiver.isRunning()) return "";
                    return "http://127.0.0.1:" + receiver.getPort();
                }
            }, "TonniNative");
        } catch (Throwable error) {
            Log.w(TAG, "Could not expose the save endpoint to the page", error);
        }

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                handleDownload(url, contentDisposition, mimeType);
            } catch (Throwable error) {
                Log.w(TAG, "Download failed for " + url, error);
            }
        });
    }

    /** Saves `data:` payloads locally, hands anything else to the system browser. */
    private void handleDownload(String url, String contentDisposition, String mimeType) {
        if (url != null && url.startsWith("data:")) {
            String mime = mimeType == null || mimeType.isEmpty() ? LocalFileReceiver.mimeFromDataUrl(url) : mimeType;
            byte[] payload = LocalFileReceiver.decodeDataUrl(url);
            if (payload == null || payload.length == 0) {
                notifyUser("Could not save this file");
                return;
            }
            String name = LocalFileReceiver.nameFromDisposition(contentDisposition, url, mime);
            try {
                String saved = LocalFileReceiver.saveStream(
                    getApplicationContext(),
                    new ByteArrayInputStream(payload),
                    payload.length,
                    name,
                    mime
                );
                notifyUser("Saved to " + saved);
            } catch (Throwable error) {
                Log.w(TAG, "Could not store download", error);
                notifyUser("Could not save this file");
            }
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Throwable error) {
            Log.w(TAG, "No app could open " + url, error);
            notifyUser("No app can open this link");
        }
    }

    private void notifyUser(String message) {
        runOnUiThread(() -> Toast.makeText(getApplicationContext(), message, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onDestroy() {
        if (fileReceiver != null) {
            fileReceiver.stop();
            fileReceiver = null;
        }
        super.onDestroy();
    }
}
