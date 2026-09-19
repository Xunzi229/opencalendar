#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  fs,
  path::{Path, PathBuf},
  sync::{Arc, Mutex},
  time::{Duration, Instant},
};

use chrono::Local;
use reqwest::Client;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{
  image::Image,
  menu::{Menu, MenuItem},
  PhysicalPosition,
  Position,
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  App, AppHandle, Emitter, LogicalSize, Manager, Size, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

const CLOCK_POLL_INTERVAL_SECONDS: u64 = 30;
const WINDOW_MARGIN: i32 = 12;
const DEFAULT_WINDOW_WIDTH: i32 = 420;
const DEFAULT_WINDOW_HEIGHT: i32 = 540;
const SETTINGS_WINDOW_WIDTH: i32 = 420;
const SETTINGS_WINDOW_HEIGHT: i32 = 360;
const FOCUS_HIDE_DELAY_MILLIS: u64 = 350;
const TRAY_TOGGLE_SUPPRESS_MILLIS: u64 = 250;

struct AppState {
  config_path: PathBuf,
  database_path: PathBuf,
  last_main_window_shown_at: Mutex<Option<Instant>>,
  last_main_window_hidden_at: Mutex<Option<Instant>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AppConfig {
  #[serde(default)]
  tian_api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClockSnapshot {
  iso: String,
  date_key: String,
  timezone_offset: i32,
  time_zone: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AlmanacRecord {
  date: String,
  lunar_month_label: String,
  lunar_day_label: String,
  ganzhi_year: String,
  zodiac: String,
  festival: String,
  good: String,
  bad: String,
  updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
struct AlmanacResult {
  record: Option<AlmanacRecord>,
  source: String,
}

#[derive(Debug, Deserialize)]
struct TianApiResponse {
  code: i32,
  #[allow(dead_code)]
  msg: String,
  result: Option<TianApiResult>,
}

#[derive(Debug, Deserialize)]
struct TianApiResult {
  gregoriandate: Option<String>,
  festival: Option<String>,
  tiangandizhiyear: Option<String>,
  shengxiao: Option<String>,
  lubarmonth: Option<String>,
  lunarday: Option<String>,
  fitness: Option<String>,
  taboo: Option<String>,
}

impl AppState {
  fn read_config(&self) -> AppConfig {
    let content = match fs::read_to_string(&self.config_path) {
      Ok(content) => content,
      Err(_) => return AppConfig::default(),
    };

    serde_json::from_str(&content).unwrap_or_default()
  }

  fn api_key(&self) -> String {
    self.read_config().tian_api_key.unwrap_or_default().trim().to_string()
  }

  fn set_api_key(&self, value: &str) -> Result<(), String> {
    let key = value.trim();
    let mut config = self.read_config();

    if key.is_empty() {
      config.tian_api_key = None;
    } else {
      config.tian_api_key = Some(key.to_string());
    }

    let serialized = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(&self.config_path, serialized).map_err(|error| error.to_string())
  }
}

#[tauri::command]
fn get_clock_snapshot() -> ClockSnapshot {
  read_clock_snapshot()
}

#[tauri::command]
fn get_api_key(state: State<'_, Arc<AppState>>) -> String {
  state.api_key()
}

#[tauri::command]
fn set_api_key(app: AppHandle, state: State<'_, Arc<AppState>>, value: String) -> Result<(), String> {
  state.set_api_key(&value)?;
  app.emit("almanac-updated", Option::<AlmanacRecord>::None)
    .map_err(|error| error.to_string())?;
  Ok(())
}

#[tauri::command]
fn close_current_window(window: WebviewWindow) -> Result<(), String> {
  window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn report_calendar_size(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
  let next_width = width.max(380.0);
  let next_height = height.max(360.0);
  window
    .set_size(Size::Logical(LogicalSize::new(next_width, next_height)))
    .map_err(|error| error.to_string())?;
  position_main_window(&window);
  Ok(())
}

#[tauri::command]
async fn get_almanac(
  app: AppHandle,
  state: State<'_, Arc<AppState>>,
  date: String,
) -> Result<AlmanacResult, String> {
  let api_key = state.api_key();

  if api_key.is_empty() {
    return Ok(AlmanacResult {
      record: None,
      source: "none".to_string(),
    });
  }

  if let Some(record) = get_cached_record(&state.database_path, &date)? {
    if is_today(&date) {
      let database_path = state.database_path.clone();
      let config_path = state.config_path.clone();
      let app_handle = app.clone();
      let requested_date = date.clone();

      tauri::async_runtime::spawn(async move {
        let key = read_api_key_from_path(&config_path);

        if key.is_empty() {
          return;
        }

        if let Ok(Some(fresh_record)) = fetch_and_cache(&database_path, &requested_date, &key).await {
          let _ = app_handle.emit("almanac-updated", Some(fresh_record));
        }
      });
    }

    return Ok(AlmanacResult {
      record: Some(record),
      source: "cache".to_string(),
    });
  }

  let record = fetch_and_cache(&state.database_path, &date, &api_key).await?;

  Ok(AlmanacResult {
    source: if record.is_some() {
      "network".to_string()
    } else {
      "none".to_string()
    },
    record,
  })
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let state = initialize_state(app)?;
      app.manage(Arc::new(state));
      start_clock_broadcast(app.handle().clone());
      build_tray(app)?;

      if let Some(window) = app.get_webview_window("main") {
        let app_handle = app.handle().clone();
        let window_handle = window.clone();
        window.on_window_event(move |event| {
          if let WindowEvent::Focused(false) = event {
            let state = app_handle.state::<Arc<AppState>>();
            let should_hide = state
              .last_main_window_shown_at
              .lock()
              .ok()
              .and_then(|last| *last)
              .map(|instant| instant.elapsed() >= Duration::from_millis(FOCUS_HIDE_DELAY_MILLIS))
              .unwrap_or(true);

            if should_hide {
              record_main_window_hidden_at(&app_handle);
              let _ = window_handle.hide();
            }
          }
        });
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_clock_snapshot,
      get_api_key,
      set_api_key,
      close_current_window,
      report_calendar_size,
      get_almanac
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn initialize_state(app: &App) -> Result<AppState, Box<dyn std::error::Error>> {
  let app_dir = app.path().app_data_dir()?;
  fs::create_dir_all(&app_dir)?;

  let state = AppState {
    config_path: app_dir.join("calendar.config.json"),
    database_path: app_dir.join("calendar-cache.sqlite"),
    last_main_window_shown_at: Mutex::new(None),
    last_main_window_hidden_at: Mutex::new(None),
  };

  initialize_database(&state.database_path)?;

  Ok(state)
}

fn initialize_database(path: &Path) -> Result<(), String> {
  let connection = Connection::open(path).map_err(|error| error.to_string())?;

  connection
    .execute_batch(
      "
      CREATE TABLE IF NOT EXISTS almanac_cache (
        date TEXT PRIMARY KEY,
        lunar_month_label TEXT NOT NULL,
        lunar_day_label TEXT NOT NULL,
        ganzhi_year TEXT NOT NULL,
        zodiac TEXT NOT NULL,
        festival TEXT NOT NULL,
        good TEXT NOT NULL,
        bad TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      ",
    )
    .map_err(|error| error.to_string())
}

fn build_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
  let show = MenuItem::with_id(app, "show", "显示日期", true, None::<&str>)?;
  let hide = MenuItem::with_id(app, "hide", "隐藏日历", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "配置黄历 TianAPI Key", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &hide, &settings, &quit])?;
  let app_handle = app.handle().clone();
  let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))?;
  let tray_builder = TrayIconBuilder::with_id("calendar-tray")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .icon(icon.clone());

  tray_builder
    .on_menu_event(move |app, event| match event.id.as_ref() {
      "show" => show_main_window(app),
      "hide" => hide_main_window(app),
      "settings" => open_settings_window(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(move |tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        toggle_main_window(tray.app_handle());
      }
    })
    .build(app)?;

  if let Some(window) = app_handle.get_webview_window("main") {
    let _ = window.set_icon(icon);
    let _ = window.hide();
  }

  Ok(())
}

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if let Ok(mut last_shown_at) = app.state::<Arc<AppState>>().last_main_window_shown_at.lock() {
      *last_shown_at = Some(Instant::now());
    }

    position_main_window(&window);
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("calendar-shown", ());
  }
}

fn hide_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    record_main_window_hidden_at(app);
    let _ = window.hide();
  }
}

fn open_settings_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("settings") {
    position_window_bottom_right(&window, SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT);
    let _ = window.show();
    let _ = window.set_focus();
    return;
  }

  let builder = WebviewWindowBuilder::new(
    app,
    "settings",
    WebviewUrl::App("index.html?view=settings".into()),
  )
  .title("Configure TianAPI Key")
  .inner_size(SETTINGS_WINDOW_WIDTH as f64, SETTINGS_WINDOW_HEIGHT as f64)
  .resizable(false)
  .minimizable(false)
  .maximizable(false)
  .always_on_top(true)
  .skip_taskbar(true)
  .visible(false);

  if let Ok(window) = builder.build() {
    position_window_bottom_right(&window, SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT);
    let _ = window.show();
    let _ = window.set_focus();
  }
}

fn toggle_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    match window.is_visible() {
      Ok(true) => {
        record_main_window_hidden_at(app);
        let _ = window.hide();
      }
      _ => {
        let hidden_too_recently = app
          .state::<Arc<AppState>>()
          .last_main_window_hidden_at
          .lock()
          .ok()
          .and_then(|last| *last)
          .map(|instant| instant.elapsed() < Duration::from_millis(TRAY_TOGGLE_SUPPRESS_MILLIS))
          .unwrap_or(false);

        if hidden_too_recently {
          return;
        }

        position_main_window(&window);
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("calendar-shown", ());
      }
    }
  }
}

fn position_main_window(window: &WebviewWindow) {
  position_window_bottom_right(window, DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
}

fn record_main_window_hidden_at(app: &AppHandle) {
  if let Ok(mut last_hidden_at) = app.state::<Arc<AppState>>().last_main_window_hidden_at.lock() {
    *last_hidden_at = Some(Instant::now());
  }
}

fn position_window_bottom_right(window: &WebviewWindow, fallback_width: i32, fallback_height: i32) {
  let Ok(Some(monitor)) = window.primary_monitor() else {
    return;
  };

  let work_area = monitor.work_area();
  let window_size = window
    .outer_size()
    .ok()
    .map(|size| (size.width as i32, size.height as i32))
    .unwrap_or((fallback_width, fallback_height));

  let x = work_area.position.x + work_area.size.width as i32 - window_size.0 - WINDOW_MARGIN;
  let y = work_area.position.y + work_area.size.height as i32 - window_size.1 - WINDOW_MARGIN;

  let _ = window.set_position(Position::Physical(PhysicalPosition::new(
    x.max(work_area.position.x),
    y.max(work_area.position.y),
  )));
}

fn start_clock_broadcast(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    let mut last = read_clock_snapshot();

    loop {
      tokio::time::sleep(Duration::from_secs(CLOCK_POLL_INTERVAL_SECONDS)).await;

      let next = read_clock_snapshot();

      if next.date_key != last.date_key
        || next.timezone_offset != last.timezone_offset
        || next.time_zone != last.time_zone
      {
        last = next.clone();
        let _ = app.emit("clock-changed", next);
      }
    }
  });
}

fn read_clock_snapshot() -> ClockSnapshot {
  let now = Local::now();

  ClockSnapshot {
    iso: now.to_rfc3339(),
    date_key: now.format("%Y-%m-%d").to_string(),
    timezone_offset: now.offset().local_minus_utc() / 60,
    time_zone: now.offset().to_string(),
  }
}

fn read_api_key_from_path(path: &Path) -> String {
  let content = match fs::read_to_string(path) {
    Ok(content) => content,
    Err(_) => return String::new(),
  };

  serde_json::from_str::<AppConfig>(&content)
    .ok()
    .and_then(|config| config.tian_api_key)
    .unwrap_or_default()
    .trim()
    .to_string()
}

fn get_cached_record(path: &Path, date: &str) -> Result<Option<AlmanacRecord>, String> {
  let connection = Connection::open(path).map_err(|error| error.to_string())?;

  connection
    .query_row(
      "
      SELECT
        date,
        lunar_month_label,
        lunar_day_label,
        ganzhi_year,
        zodiac,
        festival,
        good,
        bad,
        updated_at
      FROM almanac_cache
      WHERE date = ?1
      ",
      params![date],
      |row| {
        Ok(AlmanacRecord {
          date: row.get(0)?,
          lunar_month_label: row.get(1)?,
          lunar_day_label: row.get(2)?,
          ganzhi_year: row.get(3)?,
          zodiac: row.get(4)?,
          festival: row.get(5)?,
          good: row.get(6)?,
          bad: row.get(7)?,
          updated_at: row.get(8)?,
        })
      },
    )
    .optional()
    .map_err(|error| error.to_string())
}

async fn fetch_and_cache(path: &Path, date: &str, api_key: &str) -> Result<Option<AlmanacRecord>, String> {
  if api_key.trim().is_empty() {
    return Ok(None);
  }

  let client = Client::new();
  let response = client
    .get("https://apis.tianapi.com/lunar/index")
    .query(&[("key", api_key), ("date", date)])
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let data: TianApiResponse = response.json().await.map_err(|error| error.to_string())?;

  if data.code != 200 {
    return Ok(None);
  }

  let Some(result) = data.result else {
    return Ok(None);
  };

  let record = AlmanacRecord {
    date: result.gregoriandate.unwrap_or_else(|| date.to_string()),
    lunar_month_label: result.lubarmonth.unwrap_or_default(),
    lunar_day_label: result.lunarday.unwrap_or_default(),
    ganzhi_year: result.tiangandizhiyear.unwrap_or_default(),
    zodiac: result.shengxiao.unwrap_or_default(),
    festival: result.festival.unwrap_or_default(),
    good: normalize_list(result.fitness),
    bad: normalize_list(result.taboo),
    updated_at: Local::now().timestamp_millis(),
  };

  if record.good.is_empty() || record.bad.is_empty() {
    return Ok(None);
  }

  let connection = Connection::open(path).map_err(|error| error.to_string())?;

  connection
    .execute(
      "
      INSERT INTO almanac_cache (
        date, lunar_month_label, lunar_day_label, ganzhi_year, zodiac, festival, good, bad, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(date) DO UPDATE SET
        lunar_month_label = excluded.lunar_month_label,
        lunar_day_label = excluded.lunar_day_label,
        ganzhi_year = excluded.ganzhi_year,
        zodiac = excluded.zodiac,
        festival = excluded.festival,
        good = excluded.good,
        bad = excluded.bad,
        updated_at = excluded.updated_at
      ",
      params![
        record.date,
        record.lunar_month_label,
        record.lunar_day_label,
        record.ganzhi_year,
        record.zodiac,
        record.festival,
        record.good,
        record.bad,
        record.updated_at,
      ],
    )
    .map_err(|error| error.to_string())?;

  Ok(Some(record))
}

fn normalize_list(value: Option<String>) -> String {
  value
    .unwrap_or_default()
    .replace('.', " ")
    .replace('\u{3002}', " ")
    .replace('/', " ")
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
}

fn is_today(date: &str) -> bool {
  Local::now().format("%Y-%m-%d").to_string() == date
}
