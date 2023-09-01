// extern crate walkdir;
// extern crate rayon;
// extern crate image;
// extern crate serde_yaml;
// extern crate serde;

use image::GenericImageView;
use rayon::prelude::*;
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

struct Options {
    /// The root folder to search for sprite directories
    root_folder: String,
    /// The name of the file to write the summary to
    summary_filename: String,
    /// The alpha value below which pixels are considered "background"
    background_alpha: u8,
    /// If `true`, the sprite's border-box will be computed, based on the background_alpha value
    compute_border_box: bool,
    /// If `true`, bypass the cache
    force: bool,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct BorderBox {
    left: u32,
    right: u32,
    top: u32,
    bottom: u32,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct ImageSummary {
    name: String,
    width: u32,
    height: u32,
    checksum: String,
    changed: u64,
    border: Option<BorderBox>,
}

type FrameMap = HashMap<String, ImageSummary>;

#[derive(serde::Serialize, serde::Deserialize)]
struct SpriteSourceSummary {
    path: String,
    count: u16,
    border: Option<BorderBox>,
    frames: FrameMap,
}

type SpriteSourceMap = HashMap<String, SpriteSourceSummary>;

#[derive(serde::Serialize, serde::Deserialize)]
struct SpriteSourceRootSummary {
    sprite_count: u16,
    frame_count: u32,
    sprites: SpriteSourceMap,
}

fn summarize_contents(img: &image::DynamicImage, options: &Options) -> (String, Option<BorderBox>) {
    // Iterate over all pixels, creating a checksum of the RGBA values and determining the bounding box
    let (width, height) = img.dimensions();
    let mut checksum: u64 = 0;
    // Start the border-box inverted, so that we can "grow" it as we find foreground pixels
    let mut border_box = BorderBox {
        left: width,
        right: 0,
        top: height,
        bottom: 0,
    };
    for y in 0..height {
        for x in 0..width {
            let rgba = img.get_pixel(x, y);
            checksum = checksum.wrapping_add(
                u64::from(rgba[0])
                    + u64::from(rgba[1]) * 256
                    + u64::from(rgba[2]) * 65536
                    + u64::from(rgba[3]) * 16777216,
            );
            if !options.compute_border_box || rgba[3] < options.background_alpha {
                continue;
            }
            // If we're here then we're in foreground. The border-box is the smallest rectangle that contains all foreground pixels, and it *must* include this pixel.
            if x < border_box.left {
                border_box.left = x;
            }
            if x > border_box.right {
                border_box.right = (x).min(width - 1);
            }
            if y < border_box.top {
                border_box.top = y;
            }
            if y > border_box.bottom {
                border_box.bottom = (y).min(height - 1);
            }
        }
    }
    let checksum_string = format!("{:x}", checksum);
    return if options.compute_border_box {
        (checksum_string, Some(border_box))
    } else {
        (checksum_string, None)
    };
}

fn merge_border_boxes(boxes: Vec<BorderBox>) -> Option<BorderBox> {
    if boxes.is_empty() {
        return None;
    }
    let mut merged = boxes[0].clone();
    for box_ in boxes.iter().skip(1) {
        if box_.left < merged.left {
            merged.left = box_.left;
        }
        if box_.right > merged.right {
            merged.right = box_.right;
        }
        if box_.top < merged.top {
            merged.top = box_.top;
        }
        if box_.bottom > merged.bottom {
            merged.bottom = box_.bottom;
        }
    }
    Some(merged)
}

fn process_sprite_dir(
    dir: &Path,
    sprite_source_summary: &SpriteSourceMap,
    options: &Options,
) -> Option<SpriteSourceSummary> {
    let dirname = dir
        .strip_prefix(&Path::new(&options.root_folder))
        .expect("Failed to strip prefix")
        .to_str()?
        .to_string();
    let dir_summary = sprite_source_summary.get(&dirname);

    let png_files: Vec<_> = dir
        .read_dir()
        .expect("Failed to read directory")
        .map(|entry| entry.expect("Failed to read entry"))
        .filter(|entry| entry.path().extension().and_then(|s| s.to_str()) == Some("png"))
        .collect();

    if png_files.is_empty() {
        return None;
    }

    let images: Vec<ImageSummary> = png_files
        .into_iter()
        .filter_map(|file: fs::DirEntry| -> Option<ImageSummary> {
            let name = file
                .file_name()
                .into_string()
                .expect("Failed to get filename");
            let modified_at = get_modified_timestamp(&file);
            // If we have a prior summary for this file, check the modified time. If it's the same, we can re-use the checksum instead of calculating a new one.

            let frame_summary = dir_summary.and_then(|s| s.frames.get(&name));
            let is_unchanged = !options.force
                && frame_summary.map_or(false, |summary| summary.changed == modified_at);

            if frame_summary.is_some() && is_unchanged {
                let frame = frame_summary.unwrap();
                return Some(ImageSummary {
                    name,
                    width: frame.width,
                    height: frame.height,
                    border: frame.border.clone(),
                    checksum: frame.checksum.clone(),
                    changed: modified_at,
                });
            }

            let img = image::open(&file.path()).ok()?;
            let new_summary = summarize_contents(&img, options);
            return Some(ImageSummary {
                name,
                width: img.width(),
                height: img.height(),
                border: new_summary.1,
                checksum: new_summary.0,
                changed: modified_at,
            });
        })
        .collect();
    Some(SpriteSourceSummary {
        path: dirname,
        count: images.len() as u16,
        border: if options.compute_border_box {
            merge_border_boxes(images.iter().filter_map(|s| s.border.clone()).collect())
        } else {
            None
        },
        frames: images
            .into_iter()
            .map(|s| (s.name.clone(), s))
            .collect::<FrameMap>(),
    })
}

fn get_modified_timestamp(file: &std::fs::DirEntry) -> u64 {
    let metadata = fs::metadata(file.path()).expect("Failed to get metadata");
    let modified_at = metadata
        .modified()
        .expect("Failed to get modified time")
        .duration_since(UNIX_EPOCH)
        .expect("Failed to get duration since epoch")
        .as_secs();
    modified_at
}

fn get_dirs(root_folder: &str, max_depth: usize) -> Vec<walkdir::DirEntry> {
    let sprite_dirs: Vec<_> = WalkDir::new(root_folder)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_dir())
        .collect();
    sprite_dirs
}

fn load_summary(file_path: &PathBuf) -> SpriteSourceRootSummary {
    match File::open(file_path) {
        Ok(file) => {
            let reader = BufReader::new(file);
            let sprite_source_root_summary: SpriteSourceRootSummary =
                serde_yaml::from_reader::<BufReader<File>, SpriteSourceRootSummary>(reader)
                    .unwrap_or(SpriteSourceRootSummary {
                        sprite_count: 0,
                        frame_count: 0,
                        sprites: HashMap::new(),
                    });
            sprite_source_root_summary
        }
        Err(_) => SpriteSourceRootSummary {
            sprite_count: 0,
            frame_count: 0,
            sprites: HashMap::new(),
        },
    }
}

fn update_sprite_source_summary(options: &Options) -> SpriteSourceRootSummary {
    let outpath = Path::new(&options.root_folder).join(&options.summary_filename);
    let summary = load_summary(&outpath);
    let sprites = summary.sprites;
    let max_depth: usize = 2;
    let dirs = get_dirs(&options.root_folder, max_depth);

    let sprite_sources: Vec<_> = dirs
        .par_iter()
        .filter_map(|dir| process_sprite_dir(dir.path(), &sprites, options))
        .filter(|s| s.count > 0)
        .collect();

    let root_summary = SpriteSourceRootSummary {
        sprite_count: sprite_sources.len() as u16,
        frame_count: sprite_sources.iter().map(|s| s.count as u32).sum::<u32>(),
        sprites: sprite_sources
            .into_iter()
            .map(|s| (s.path.clone(), s))
            .collect(),
    };

    let yaml = serde_yaml::to_string(&root_summary).expect("Failed to serialize");
    fs::write(outpath, yaml).expect("Unable to write file");
    return root_summary;
}

fn main() {
    let options = Options {
        root_folder: "../../../crashlands-2/Crashlands2/sprites".to_string(),
        summary_filename: ".sprite-info.yaml".to_string(),
        background_alpha: 1,
        compute_border_box: true,
        force: false,
    };
    update_sprite_source_summary(&options);
}
