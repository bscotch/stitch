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
use std::time::Instant;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct ImageSummary {
    name: String,
    width: u32,
    height: u32,
    checksum: String,
    changed: u64,
}

type FrameMap = HashMap<String, ImageSummary>;

#[derive(serde::Serialize, serde::Deserialize)]
struct SpriteSourceSummary {
    path: String,
    count: u16,
    frames: FrameMap,
}

type SpriteSourceMap = HashMap<String, SpriteSourceSummary>;

#[derive(serde::Serialize, serde::Deserialize)]
struct SpriteSourceRootSummary {
    sprite_count: u16,
    frame_count: u32,
    sprites: SpriteSourceMap,
}

fn calculate_checksum(img: &image::DynamicImage) -> String {
    let checksum = img.pixels().fold(0u64, |acc, pixel| {
        let (_, _, rgba) = pixel;
        acc.wrapping_add(
            u64::from(rgba[0])
                + u64::from(rgba[1]) * 256
                + u64::from(rgba[2]) * 65536
                + u64::from(rgba[3]) * 16777216,
        )
    });
    format!("{:x}", checksum)
}

fn process_sprite_dir(
    dir: &Path,
    root_folder: &str,
    sprite_source_summary: &SpriteSourceMap,
) -> Option<SpriteSourceSummary> {
    let dirname = dir
        .strip_prefix(&Path::new(root_folder))
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
            let is_unchanged =
                frame_summary.map_or(false, |summary| summary.changed == modified_at);

            if frame_summary.is_some() && is_unchanged {
                let frame = frame_summary.unwrap();
                return Some(ImageSummary {
                    name,
                    width: frame.width,
                    height: frame.height,
                    checksum: frame.checksum.clone(),
                    changed: modified_at,
                });
            }

            let img = image::open(&file.path()).ok()?;
            return Some(ImageSummary {
                name,
                width: img.width(),
                height: img.height(),
                checksum: calculate_checksum(&img),
                changed: modified_at,
            });
        })
        .collect();
    Some(SpriteSourceSummary {
        path: dirname,
        count: images.len() as u16,
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
                    .expect("Failed to deserialize the summary file");
            sprite_source_root_summary
        }
        Err(_) => SpriteSourceRootSummary {
            sprite_count: 0,
            frame_count: 0,
            sprites: HashMap::new(),
        },
    }
}

fn main() {
    let root_folder = "../../../crashlands-2/Crashlands2/sprites";
    let summary_filename = ".sprite-info.yaml";

    let outpath = Path::new(&root_folder).join(summary_filename);
    let summary = load_summary(&outpath);
    let sprites = summary.sprites;
    let max_depth: usize = 2;
    let dirs = get_dirs(root_folder, max_depth);

    let sprite_sources: Vec<_> = dirs
        .par_iter()
        .filter_map(|dir| process_sprite_dir(dir.path(), root_folder, &sprites))
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
}
