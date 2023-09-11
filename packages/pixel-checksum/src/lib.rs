use image::GenericImageView;
use neon::prelude::*;
use rayon::prelude::*;

fn compute_png_checksum(file: &String) -> String {
    let img = image::open(&file).expect("Failed to open image");
    let (width, height) = img.dimensions();
    img.pixels().par_bridge().for_each(|_| {});
    let mut checksum: u64 = 0;
    for y in 0..height {
        for x in 0..width {
            let rgba = img.get_pixel(x, y);
            checksum = checksum.wrapping_add(
                u64::from(rgba[0])
                    + u64::from(rgba[1]) * 256
                    + u64::from(rgba[2]) * 65536
                    + u64::from(rgba[3]) * 16777216,
            );
        }
    }
    format!("{:x}", checksum)
}

fn node_compute_png_checksum(mut cx: FunctionContext) -> JsResult<JsString> {
    // Get the first argument as a `JsString` and convert to a Rust `String`
    let file = cx.argument::<JsString>(0)?.value(&mut cx);
    let checksum = compute_png_checksum(&file);
    Ok(cx.string(checksum))
}

fn node_compute_png_checksums(mut cx: FunctionContext) -> JsResult<JsArray> {
    // Iterate over the images in parallel, computing the checksum for each
    let js_path_array = cx.argument::<JsArray>(0)?.to_vec(&mut cx)?;

    let paths: Vec<String> = js_path_array
        .iter()
        .map(|js_value| {
            let js_string = js_value
                .downcast::<JsString, FunctionContext>(&mut cx)
                .or_throw(&mut cx)
                .unwrap();
            js_string.value(&mut cx)
        })
        .collect();
    // Get the checksums as a vec of strings, using rayon
    let checksums: Vec<String> = paths
        .par_iter()
        .map(|path| compute_png_checksum(path))
        .collect();
    // Convert the checksums to a JsArray
    let js_checksum_array = JsArray::new(&mut cx, checksums.len() as u32);
    for (i, checksum) in checksums.iter().enumerate() {
        let js_checksum = cx.string(checksum);
        js_checksum_array.set(&mut cx, i as u32, js_checksum)?;
    }
    Ok(js_checksum_array)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("computePngChecksum", node_compute_png_checksum)?;
    cx.export_function("computePngChecksums", node_compute_png_checksums)?;
    Ok(())
}
