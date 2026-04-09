// Minimal Tauri shell around the shared React app.
// The native layer owns desktop-only window behavior: booting the same frontend
// in dev/prod, opening the drill popout, and keeping that popout's native
// window state in sync with the frontend's settings.
use serde::Serialize;
use std::process::Command;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const LOCALHOST_HOST: &str = "127.0.0.1";
const LOCALHOST_PORT: u16 = 1430;
const DRILL_POPOUT_LABEL: &str = "drill-popout";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPlatformInfo {
    os: &'static str,
    arch: &'static str,
}

#[tauri::command]
async fn open_drill_popout(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DRILL_POPOUT_LABEL) {
        // Recreate the popout from a known-good URL to avoid getting stuck
        // with a stale blank webview from a previous failed boot.
        window.destroy().map_err(|error| error.to_string())?;
    }

    #[cfg(debug_assertions)]
    let mut popout_url = app
        .config()
        .build
        .dev_url
        .clone()
        .ok_or_else(|| "devUrl must be configured for tauri dev".to_string())?;

    #[cfg(not(debug_assertions))]
    let mut popout_url: tauri::Url = format!("http://{LOCALHOST_HOST}:{LOCALHOST_PORT}/index.html")
        .parse::<tauri::Url>()
        .map_err(|error| error.to_string())?;

    popout_url.set_path("/popout.html");
    popout_url.set_query(None);
    popout_url.set_fragment(None);

    let popout_window = WebviewWindowBuilder::new(
        &app,
        DRILL_POPOUT_LABEL,
        WebviewUrl::External(popout_url),
    )
    .title("JSRF Bingus Trainer Drill")
    .inner_size(760.0, 920.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|error| error.to_string())?;

    popout_window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())?;
    popout_window.show().map_err(|error| error.to_string())?;
    popout_window
        .set_focus()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_drill_popout_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DRILL_POPOUT_LABEL) {
        window
            .set_always_on_top(always_on_top)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_desktop_platform_info() -> DesktopPlatformInfo {
    DesktopPlatformInfo {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed_url = url.trim();

    if !trimmed_url.starts_with("https://") {
        return Err("Only https release URLs are supported.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(trimmed_url)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", trimmed_url])
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(trimmed_url)
            .spawn()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return Err("Opening external URLs is unsupported on this target.".to_string());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_drill_popout,
            set_drill_popout_always_on_top,
            get_desktop_platform_info,
            open_external_url
        ])
        .plugin(
            tauri_plugin_localhost::Builder::new(LOCALHOST_PORT)
                .host(LOCALHOST_HOST)
                .build(),
        );

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .expect("main window config should exist");

            #[cfg(debug_assertions)]
            let app_url = app
                .config()
                .build
                .dev_url
                .clone()
                .expect("devUrl must be configured for tauri dev");

            #[cfg(not(debug_assertions))]
            let app_url = format!("http://{LOCALHOST_HOST}:{LOCALHOST_PORT}/index.html").parse()?;

            // Tauri's generated window config is still the source of truth for
            // sizing and constraints; we only swap in the external URL here.
            let mut builder =
                WebviewWindowBuilder::new(app, window_config.label.clone(), WebviewUrl::External(app_url));

            builder = builder.title(window_config.title.clone());

            builder = builder
                .inner_size(window_config.width, window_config.height)
                .resizable(window_config.resizable)
                .fullscreen(window_config.fullscreen);

            if let (Some(min_width), Some(min_height)) =
                (window_config.min_width, window_config.min_height)
            {
                builder = builder.min_inner_size(min_width, min_height);
            }

            if let Some(max_width) = window_config.max_width {
                if let Some(max_height) = window_config.max_height {
                    builder = builder.max_inner_size(max_width, max_height);
                }
            }

            if window_config.center {
                builder = builder.center();
            }

            builder.build()?;

            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
