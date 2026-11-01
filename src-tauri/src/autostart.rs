use std::path::PathBuf;

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::{fs, io::ErrorKind};

pub struct Autostart {
  executable: PathBuf,
  #[cfg(any(target_os = "macos", target_os = "linux"))]
  entry: PathBuf,
}

impl Autostart {
  pub fn new(executable: PathBuf) -> Result<Self, String> {
    #[cfg(target_os = "macos")]
    let entry = dirs::home_dir()
      .ok_or("无法定位用户目录")?
      .join("Library/LaunchAgents/com.local.calendar.plist");
    #[cfg(target_os = "linux")]
    let entry = dirs::config_dir()
      .ok_or("无法定位用户配置目录")?
      .join("autostart/com.local.calendar.desktop");
    Ok(Self {
      executable,
      #[cfg(any(target_os = "macos", target_os = "linux"))]
      entry,
    })
  }

  pub fn set_enabled(&self, enabled: bool) -> Result<bool, String> {
    if enabled {
      self.enable()?;
    } else {
      self.disable()?;
    }
    let actual = self.is_enabled()?;
    if actual != enabled {
      return Err("系统启动项未更新，请重试".into());
    }
    Ok(actual)
  }

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  fn disable(&self) -> Result<(), String> {
    match fs::remove_file(&self.entry) {
      Ok(()) => Ok(()),
      Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
      Err(error) => Err(error.to_string()),
    }
  }

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  fn write_entry(&self, bytes: &[u8]) -> Result<(), String> {
    let parent = self.entry.parent().ok_or("启动项目录无效")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = self.entry.with_extension("tmp");
    let result = fs::write(&temporary, bytes).and_then(|_| fs::rename(&temporary, &self.entry));
    if result.is_err() {
      let _ = fs::remove_file(&temporary);
    }
    result.map_err(|error| error.to_string())
  }

  #[cfg(target_os = "macos")]
  fn enable(&self) -> Result<(), String> {
    let path = self.executable.to_str().ok_or("程序路径编码无效")?;
    let mut values = plist::Dictionary::new();
    values.insert("Label".into(), "com.local.calendar".into());
    values.insert(
      "ProgramArguments".into(),
      plist::Value::Array(vec![path.into(), "--autostart".into()]),
    );
    values.insert("RunAtLoad".into(), true.into());
    let mut bytes = Vec::new();
    plist::Value::Dictionary(values)
      .to_writer_xml(&mut bytes)
      .map_err(|error| error.to_string())?;
    self.write_entry(&bytes)
  }

  #[cfg(target_os = "macos")]
  pub fn is_enabled(&self) -> Result<bool, String> {
    let bytes = match fs::read(&self.entry) {
      Ok(bytes) => bytes,
      Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
      Err(error) => return Err(error.to_string()),
    };
    let value =
      plist::Value::from_reader(std::io::Cursor::new(bytes)).map_err(|error| error.to_string())?;
    let values = value.as_dictionary().ok_or("启动项格式无效")?;
    let arguments = values
      .get("ProgramArguments")
      .and_then(plist::Value::as_array);
    Ok(
      values.get("Disabled").and_then(plist::Value::as_boolean) != Some(true)
        && values.get("RunAtLoad").and_then(plist::Value::as_boolean) == Some(true)
        && arguments
          .and_then(|args| args.first())
          .and_then(plist::Value::as_string)
          == self.executable.to_str(),
    )
  }

  #[cfg(target_os = "linux")]
  fn enable(&self) -> Result<(), String> {
    let command = desktop_command(self.executable.to_str().ok_or("程序路径编码无效")?)?;
    self.write_entry(format!("[Desktop Entry]\nType=Application\nVersion=1.0\nName=OpenCalendar\nExec={command}\nTerminal=false\nStartupNotify=false\nX-GNOME-Autostart-enabled=true\n").as_bytes())
  }

  #[cfg(target_os = "linux")]
  pub fn is_enabled(&self) -> Result<bool, String> {
    let data = match fs::read_to_string(&self.entry) {
      Ok(data) => data,
      Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
      Err(error) => return Err(error.to_string()),
    };
    let command = desktop_command(self.executable.to_str().ok_or("程序路径编码无效")?)?;
    let mut in_entry = false;
    let mut matches_command = false;
    let mut hidden = false;
    let mut allowed = true;
    for line in data.lines().map(str::trim) {
      if line.starts_with('[') {
        in_entry = line == "[Desktop Entry]";
        continue;
      }
      if !in_entry {
        continue;
      }
      if let Some((key, value)) = line.split_once('=') {
        match key.trim() {
          "Exec" => matches_command = value.trim() == command,
          "Hidden" => hidden = value.trim().eq_ignore_ascii_case("true"),
          "X-GNOME-Autostart-enabled" => allowed = !value.trim().eq_ignore_ascii_case("false"),
          _ => {}
        }
      }
    }
    Ok(matches_command && !hidden && allowed)
  }
}

#[cfg(any(target_os = "linux", test))]
fn desktop_command(path: &str) -> Result<String, String> {
  if path.chars().any(char::is_control) {
    return Err("程序路径包含控制字符".into());
  }
  let escaped = path
    .replace('\\', "\\\\\\\\")
    .replace('"', "\\\\\"")
    .replace('`', "\\\\`")
    .replace('$', "\\\\$")
    .replace('%', "%%");
  Ok(format!("\"{escaped}\" --autostart"))
}

#[cfg(any(target_os = "windows", test))]
fn windows_command(path: &str) -> Result<String, String> {
  if path
    .chars()
    .any(|character| character.is_control() || character == '"')
  {
    return Err("程序路径包含无效字符".into());
  }
  Ok(format!("\"{path}\" --autostart"))
}

#[cfg(any(target_os = "windows", test))]
fn startup_approved(bytes: &[u8]) -> Result<bool, String> {
  if bytes.len() < 12 {
    return Err("系统启动项状态无效".into());
  }
  match bytes[0] {
    2 | 6 => Ok(true),
    3 | 7 => Ok(false),
    _ => Err("无法识别系统启动项状态".into()),
  }
}

#[cfg(target_os = "windows")]
mod windows {
  use super::Autostart;
  use std::io::ErrorKind;
  use winreg::{
    enums::{HKEY_CURRENT_USER, KEY_SET_VALUE, REG_BINARY},
    RegKey, RegValue,
  };

  const NAME: &str = "OpenCalendar";
  const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
  const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

  impl Autostart {
    fn command(&self) -> Result<String, String> {
      super::windows_command(self.executable.to_str().ok_or("程序路径编码无效")?)
    }

    pub(super) fn enable(&self) -> Result<(), String> {
      let user = RegKey::predef(HKEY_CURRENT_USER);
      let command = self.command()?;
      user
        .create_subkey(RUN)
        .and_then(|(key, _)| key.set_value(NAME, &command))
        .map_err(|error| error.to_string())?;
      let bytes = vec![2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      user
        .create_subkey(APPROVED)
        .and_then(|(key, _)| {
          key.set_raw_value(
            NAME,
            &RegValue {
              vtype: REG_BINARY,
              bytes,
            },
          )
        })
        .map_err(|error| error.to_string())
    }

    pub(super) fn disable(&self) -> Result<(), String> {
      let user = RegKey::predef(HKEY_CURRENT_USER);
      for path in [RUN, APPROVED] {
        match user
          .open_subkey_with_flags(path, KEY_SET_VALUE)
          .and_then(|key| key.delete_value(NAME))
        {
          Ok(()) => {}
          Err(error) if error.kind() == ErrorKind::NotFound => {}
          Err(error) => return Err(error.to_string()),
        }
      }
      Ok(())
    }

    pub fn is_enabled(&self) -> Result<bool, String> {
      let user = RegKey::predef(HKEY_CURRENT_USER);
      let registered: String = match user.open_subkey(RUN).and_then(|key| key.get_value(NAME)) {
        Ok(value) => value,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.to_string()),
      };
      if registered != self.command()? {
        return Ok(false);
      }
      match user
        .open_subkey(APPROVED)
        .and_then(|key| key.get_raw_value(NAME))
      {
        Ok(value) if value.vtype == REG_BINARY => super::startup_approved(&value.bytes),
        Ok(_) => Err("系统启动项状态格式无效".into()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(true),
        Err(error) => Err(error.to_string()),
      }
    }
  }
}

#[cfg(test)]
mod tests {
  #[test]
  fn quotes_desktop_paths_with_spaces_and_field_codes() {
    assert_eq!(
      super::desktop_command("/home/user/My Apps/日历%1.AppImage").unwrap(),
      "\"/home/user/My Apps/日历%%1.AppImage\" --autostart"
    );
  }

  #[test]
  fn rejects_newlines_in_desktop_paths() {
    assert!(super::desktop_command("/tmp/app\nHidden=true").is_err());
  }

  #[test]
  fn escapes_desktop_reserved_characters_before_command_parsing() {
    let command = super::desktop_command("/tmp/a\\b\"$`%/calendar").unwrap();
    assert_eq!(command, r#""/tmp/a\\\\b\\"\\$\\`%%/calendar" --autostart"#);
  }

  #[test]
  fn quotes_windows_executable_separately_from_arguments() {
    assert_eq!(
      super::windows_command(r"C:\Program Files\日历\Calendar.exe").unwrap(),
      r#""C:\Program Files\日历\Calendar.exe" --autostart"#
    );
    assert!(super::windows_command("C:\\app\".exe").is_err());
  }

  #[test]
  fn detects_task_manager_disabled_entries_even_without_timestamp() {
    for (flag, enabled) in [(2, true), (6, true), (3, false), (7, false)] {
      let mut bytes = [0; 12];
      bytes[0] = flag;
      assert_eq!(super::startup_approved(&bytes).unwrap(), enabled);
    }
    assert!(super::startup_approved(&[]).is_err());
    assert!(super::startup_approved(&[0; 12]).is_err());
  }
}
