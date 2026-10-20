package com.kamalscan.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "KamalScanActivity";
    private String pendingFileJson = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Process any incoming file intent on cold start
        handleIncomingIntent(getIntent());

        // Add JavaScript interface so the React app can pull the pending file upon startup
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public String getPendingFile() {
                    String data = pendingFileJson;
                    pendingFileJson = null; // consume once
                    return data != null ? data : "";
                }
            }, "KamalScanAndroidBridge");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Received intent with action: " + action);

        if (Intent.ACTION_VIEW.equals(action) || Intent.ACTION_SEND.equals(action)) {
            Uri fileUri = null;
            if (Intent.ACTION_VIEW.equals(action)) {
                fileUri = intent.getData();
            } else if (Intent.ACTION_SEND.equals(action)) {
                fileUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }

            if (fileUri != null) {
                processFileUri(fileUri, intent.getType());
            }
        }
    }

    private void processFileUri(Uri uri, String explicitMimeType) {
        try {
            ContentResolver resolver = getContentResolver();
            String fileName = "document";
            String mimeType = explicitMimeType;

            // Resolve file name from content resolver
            Cursor cursor = resolver.query(uri, null, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIndex != -1) {
                            fileName = cursor.getString(nameIndex);
                        }
                    }
                } finally {
                    cursor.close();
                }
            }

            if (mimeType == null || mimeType.isEmpty() || "*/*".equals(mimeType)) {
                mimeType = resolver.getType(uri);
                if (mimeType == null) {
                    if (fileName.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
                    else if (fileName.toLowerCase().endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    else if (fileName.toLowerCase().endsWith(".doc")) mimeType = "application/msword";
                    else if (fileName.toLowerCase().endsWith(".pptx")) mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                    else if (fileName.toLowerCase().endsWith(".ppt")) mimeType = "application/vnd.ms-powerpoint";
                    else if (fileName.toLowerCase().endsWith(".txt")) mimeType = "text/plain";
                    else mimeType = "application/octet-stream";
                }
            }

            // Read file bytes
            InputStream inputStream = resolver.openInputStream(uri);
            if (inputStream != null) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] temp = new byte[16384];
                int bytesRead;
                while ((bytesRead = inputStream.read(temp, 0, temp.length)) != -1) {
                    buffer.write(temp, 0, bytesRead);
                }
                buffer.flush();
                byte[] fileBytes = buffer.toByteArray();
                inputStream.close();

                String base64Data = Base64.encodeToString(fileBytes, Base64.NO_WRAP);

                JSONObject payload = new JSONObject();
                payload.put("name", fileName);
                payload.put("mimeType", mimeType);
                payload.put("base64", base64Data);

                pendingFileJson = payload.toString();
                Log.d(TAG, "Successfully processed incoming file: " + fileName + " (" + fileBytes.length + " bytes)");

                // If webview is already running, notify it immediately via window event
                notifyWebViewOfFile(pendingFileJson);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming file URI: " + uri, e);
        }
    }

    private void notifyWebViewOfFile(final String jsonPayload) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            runOnUiThread(() -> {
                String js = "window.dispatchEvent(new CustomEvent('kamalscan:androidFileOpen', { detail: " + jsonPayload + " }));";
                getBridge().getWebView().evaluateJavascript(js, null);
            });
        }
    }
}
