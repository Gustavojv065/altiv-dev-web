package online.altive.dev;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView browser;
    private ProgressBar loading;
    private TextView status;
    private final Uri portal = Uri.parse(BuildConfig.PORTAL_URL);

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(9, 13, 20));
        getWindow().setNavigationBarColor(Color.rgb(9, 13, 20));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(9, 13, 20));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(9), dp(8), dp(9));
        header.setBackgroundColor(Color.rgb(13, 19, 28));

        TextView brand = new TextView(this);
        brand.setText("A  ALTIVE DEV");
        brand.setTextColor(Color.WHITE);
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        brand.setTextSize(18);
        header.addView(brand, new LinearLayout.LayoutParams(0, dp(42), 1));

        Button back = new Button(this);
        back.setText("Voltar");
        back.setAllCaps(false);
        back.setOnClickListener(v -> {
            if (browser != null && browser.canGoBack()) browser.goBack();
            else if (browser != null) browser.loadUrl(BuildConfig.PORTAL_URL);
        });
        header.addView(back, new LinearLayout.LayoutParams(dp(86), dp(48)));

        Button reload = new Button(this);
        reload.setText("↻");
        reload.setContentDescription("Recarregar");
        reload.setOnClickListener(v -> {
            if (browser != null) browser.reload();
        });
        header.addView(reload, new LinearLayout.LayoutParams(dp(48), dp(48)));

        root.addView(header);
        loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loading.setMax(100);
        root.addView(loading, new LinearLayout.LayoutParams(-1, dp(3)));

        status = new TextView(this);
        status.setTextColor(Color.rgb(243, 199, 142));
        status.setTextSize(12);
        status.setPadding(dp(12),dp(5),dp(12),dp(5));
        status.setVisibility(View.GONE);
        root.addView(status);

        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(9, 13, 20));
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); // Next.js needs JS
        settings.setDomStorageEnabled(true); // session UI
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (android.os.Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false);

        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int progress) {
                loading.setProgress(progress);
                loading.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                if ("https".equalsIgnoreCase(scheme) && portal.getHost().equalsIgnoreCase(url.getHost())) {
                    return false;
                }
                // Do not allow non-HTTPS or custom-scheme navigation inside the embedded browser.
                if ("https".equalsIgnoreCase(scheme)) {
                    Intent outside = new Intent(Intent.ACTION_VIEW, url);
                    if (outside.resolveActivity(getPackageManager()) != null) startActivity(outside);
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    status.setText("Sem conexão com a ALTIVE DEV. Verifique sua internet e toque em ↻.");
                    status.setVisibility(View.VISIBLE);
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                // Do not claim success if a network error was reported.
                CookieManager.getInstance().flush();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // Never bypass HTTPS errors.
                status.setText("Não foi possível validar a conexão segura com a ALTIVE DEV.");
                status.setVisibility(View.VISIBLE);
            }
        });
        root.addView(browser, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);

        if (savedInstanceState == null) browser.loadUrl(BuildConfig.PORTAL_URL);
        else browser.restoreState(savedInstanceState);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onSaveInstanceState(Bundle state) {
        if (browser != null) browser.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onBackPressed() {
        if (browser != null && browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }

    @Override protected void onStop() {
        CookieManager.getInstance().flush();
        super.onStop();
    }

    @Override protected void onDestroy() {
        if (browser != null) {
            browser.stopLoading();
            browser.destroy();
            browser = null;
        }
        super.onDestroy();
    }
}
