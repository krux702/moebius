const black = {r: 0, g: 0, b: 0};
const blue = {r: 0, g: 0, b: 42};
const green = {r: 0, g: 42, b:   0};
const cyan = {r: 0, g: 42, b: 42};
const red = {r: 42, g: 0, b: 0};
const magenta = {r: 42, g: 0, b: 42};
const yellow = {r: 42, g: 21, b: 0};
const white = {r: 42, g: 42, b: 42};
const bright_black = {r: 21, g: 21, b: 21};
const bright_blue = {r: 21, g: 21, b: 63};
const bright_green = {r: 21, g: 63, b: 21};
const bright_cyan = {r: 21, g: 63, b: 63};
const bright_red = {r: 63, g: 21, b: 21};
const bright_magenta = {r: 63, g: 21, b: 63};
const bright_yellow = {r: 63, g: 63, b: 21};
const bright_white = {r: 63, g: 63, b: 63};

const c64_black = {r: 0, g: 0, b: 0};
const c64_white = {r: 63, g: 63, b: 63};
const c64_red = {r: 32, g: 13, b: 14};
const c64_cyan = {r: 29, g: 51, b: 50};
const c64_violet = {r: 35, g: 15, b: 37};
const c64_green = {r: 21, g: 43, b: 19};
const c64_blue = {r: 12, g: 11, b: 38};
const c64_yellow = {r: 59, g: 60, b: 28};
const c64_orange = {r: 35, g: 20, b: 10};
const c64_brown = {r: 21, g: 14, b: 0};
const c64_light_red = {r: 48, g: 27, b: 28};
const c64_dark_grey = {r: 19, g: 19, b: 18};
const c64_grey = {r: 31, g: 31, b: 31};
const c64_light_green = {r: 42, g: 63, b: 39};
const c64_light_blue = {r: 26, g: 27, b: 58};
const c64_light_grey = {r: 44, g: 44, b: 44};

const ega = [black, blue, green, cyan, red, magenta, yellow, white, bright_black, bright_blue, bright_green, bright_cyan, bright_red, bright_magenta, bright_yellow, bright_white];
const c64 = [c64_black, c64_white, c64_red, c64_cyan, c64_violet, c64_green, c64_blue, c64_yellow, c64_orange, c64_brown, c64_light_red, c64_dark_grey, c64_grey, c64_light_green, c64_light_blue, c64_light_grey];

function get_rgba(rgb) {
    return new Uint8Array([rgb.r, rgb.g, rgb.b, 255]);
}

function convert_6bits_to_8bits(value) {
    return (value << 2) | ((value & 0x30) >> 4);
}

function convert_8bits_to_6bits(value) {
    return value >> 2;
}

function clone_palette(palette) {
    return palette.map((rgb) => ({r: rgb.r, g: rgb.g, b: rgb.b}));
}

function convert_ega_to_vga(rgb) {
    return {
        r: convert_6bits_to_8bits(rgb.r),
        g: convert_6bits_to_8bits(rgb.g),
        b: convert_6bits_to_8bits(rgb.b)
    };
}

function convert_rgb_to_style(rgb) {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function convert_ega_to_style(rgb) {
    return convert_rgb_to_style(convert_ega_to_vga(rgb));
}

function has_ansi_palette(palette) {
    for (let i = 0; i < palette.length; i++) {
        if (palette[i].r != ega[i].r || palette[i].g != ega[i].g || palette[i].b != ega[i].b) return false;
    }
    return true;
}

function has_c64_palette(palette) {
    for (let i = 0; i < palette.length; i++) {
        if (palette[i].r != c64[i].r || palette[i].g != c64[i].g || palette[i].b != c64[i].b) return false;
    }
    return true;
}

// A custom 16-colour palette is one that matches neither the default EGA nor
// C64 palette, and so needs to be persisted (we store it in SAUCE comments).
function has_custom_palette(palette) {
    return palette != undefined && palette.length == 16 && !has_ansi_palette(palette) && !has_c64_palette(palette);
}

// Custom palettes are stored in the SAUCE comment block. Each palette is
// written across two comment lines, each tagged with a recognisable prefix so
// they can be separated from genuine user comments on load:
//
//   MBPAL0RRGGBBRRGGBB...   (colours 0-7,  as 8-bit VGA hex)
//   MBPAL1RRGGBBRRGGBB...   (colours 8-15, as 8-bit VGA hex)
//
// Each line is 5 (prefix) + 1 (part) + 8*6 (hex) = 54 characters, comfortably
// within the 64 character SAUCE comment line limit.
const PALETTE_COMMENT_PREFIX = "MBPAL";

function byte_to_hex(value) {
    return value.toString(16).toUpperCase().padStart(2, "0");
}

function encode_palette_comments(palette) {
    const lines = [];
    for (let part = 0; part < 2; part++) {
        let line = PALETTE_COMMENT_PREFIX + part;
        for (let i = part * 8; i < part * 8 + 8; i++) {
            const rgb = palette[i];
            line += byte_to_hex(convert_6bits_to_8bits(rgb.r)) + byte_to_hex(convert_6bits_to_8bits(rgb.g)) + byte_to_hex(convert_6bits_to_8bits(rgb.b));
        }
        lines.push(line);
    }
    return lines;
}

function is_palette_comment_line(line) {
    return typeof line == "string" && line.startsWith(PALETTE_COMMENT_PREFIX);
}

function decode_palette_comments(comments) {
    if (!comments) return undefined;
    const palette = new Array(16);
    let parts_found = 0;
    for (const line of comments.split("\n")) {
        if (!is_palette_comment_line(line)) continue;
        const part = parseInt(line.charAt(PALETTE_COMMENT_PREFIX.length), 10);
        if (part != 0 && part != 1) continue;
        const hex = line.substr(PALETTE_COMMENT_PREFIX.length + 1);
        if (hex.length < 48) continue;
        let ok = true;
        for (let i = 0; i < 8; i++) {
            const offset = i * 6;
            const r = parseInt(hex.substr(offset, 2), 16);
            const g = parseInt(hex.substr(offset + 2, 2), 16);
            const b = parseInt(hex.substr(offset + 4, 2), 16);
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                ok = false;
                break;
            }
            palette[part * 8 + i] = {r: convert_8bits_to_6bits(r), g: convert_8bits_to_6bits(g), b: convert_8bits_to_6bits(b)};
        }
        if (ok) parts_found++;
    }
    if (parts_found == 0) return undefined;
    for (let i = 0; i < 16; i++) {
        if (!palette[i]) return undefined;
    }
    return palette;
}

function strip_palette_comments(comments) {
    if (!comments) return comments;
    return comments.split("\n").filter((line) => !is_palette_comment_line(line)).join("\n");
}

module.exports = {white, bright_white, ega, c64, get_rgba, convert_6bits_to_8bits, convert_8bits_to_6bits, clone_palette, convert_ega_to_vga, convert_ega_to_style, has_ansi_palette, has_c64_palette, has_custom_palette, encode_palette_comments, decode_palette_comments, strip_palette_comments};
