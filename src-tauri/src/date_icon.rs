use tauri::image::Image;

const DATES: [&[u8]; 31] = [
  include_bytes!("../icons/dates/1.png"),
  include_bytes!("../icons/dates/2.png"),
  include_bytes!("../icons/dates/3.png"),
  include_bytes!("../icons/dates/4.png"),
  include_bytes!("../icons/dates/5.png"),
  include_bytes!("../icons/dates/6.png"),
  include_bytes!("../icons/dates/7.png"),
  include_bytes!("../icons/dates/8.png"),
  include_bytes!("../icons/dates/9.png"),
  include_bytes!("../icons/dates/10.png"),
  include_bytes!("../icons/dates/11.png"),
  include_bytes!("../icons/dates/12.png"),
  include_bytes!("../icons/dates/13.png"),
  include_bytes!("../icons/dates/14.png"),
  include_bytes!("../icons/dates/15.png"),
  include_bytes!("../icons/dates/16.png"),
  include_bytes!("../icons/dates/17.png"),
  include_bytes!("../icons/dates/18.png"),
  include_bytes!("../icons/dates/19.png"),
  include_bytes!("../icons/dates/20.png"),
  include_bytes!("../icons/dates/21.png"),
  include_bytes!("../icons/dates/22.png"),
  include_bytes!("../icons/dates/23.png"),
  include_bytes!("../icons/dates/24.png"),
  include_bytes!("../icons/dates/25.png"),
  include_bytes!("../icons/dates/26.png"),
  include_bytes!("../icons/dates/27.png"),
  include_bytes!("../icons/dates/28.png"),
  include_bytes!("../icons/dates/29.png"),
  include_bytes!("../icons/dates/30.png"),
  include_bytes!("../icons/dates/31.png"),
];

pub fn for_day(day: u32) -> tauri::Result<Image<'static>> {
  Image::from_bytes(DATES[(day.clamp(1, 31) - 1) as usize])
}

#[cfg(test)]
mod tests {
  #[test]
  fn every_date_decodes_to_a_retina_tray_icon() {
    for day in 1..=31 {
      let icon = super::for_day(day).unwrap();
      assert_eq!((icon.width(), icon.height()), (44, 44));
    }
  }
}
