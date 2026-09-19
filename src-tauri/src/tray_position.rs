// All inputs are physical desktop pixels. Work areas can have negative origins.
pub fn below_tray(
  tray: (f64, f64, f64, f64),
  window: (f64, f64),
  work: (f64, f64, f64, f64),
  gap: f64,
) -> (i32, i32) {
  let left = work.0 + gap;
  let top = work.1 + gap;
  let right = (work.0 + work.2 - window.0 - gap).max(left);
  let bottom = (work.1 + work.3 - window.1 - gap).max(top);
  let x = (tray.0 + tray.2 / 2.0 - window.0 / 2.0).clamp(left, right);
  let y = (tray.1 + tray.3 + gap).clamp(top, bottom);
  (x.round() as i32, y.round() as i32)
}

#[cfg(test)]
mod tests {
  use super::below_tray;

  #[test]
  fn centers_below_menu_bar_and_stays_anchored_after_resize() {
    let tray = (700.0, 0.0, 24.0, 24.0);
    let work = (0.0, 24.0, 1440.0, 876.0);
    assert_eq!(below_tray(tray, (420.0, 540.0), work, 6.0), (502, 30));
    assert_eq!(below_tray(tray, (420.0, 650.0), work, 6.0), (502, 30));
  }

  #[test]
  fn clamps_to_right_edge_on_retina_monitor() {
    assert_eq!(below_tray((2800.0, 0.0, 48.0, 48.0), (840.0, 1080.0),
      (0.0, 48.0, 2880.0, 1752.0), 12.0), (2028, 60));
  }

  #[test]
  fn supports_secondary_monitor_with_negative_origin() {
    assert_eq!(below_tray((-1900.0, -200.0, 24.0, 24.0), (420.0, 540.0),
      (-1920.0, -176.0, 1920.0, 1056.0), 6.0), (-1914, -170));
  }

  #[test]
  fn oversized_window_does_not_panic() {
    assert_eq!(below_tray((100.0, 0.0, 24.0, 24.0), (420.0, 540.0),
      (0.0, 24.0, 320.0, 300.0), 6.0), (6, 30));
  }
}
