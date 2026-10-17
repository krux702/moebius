const electron = require("electron");
const remote = require("@electron/remote");
const libtextmode = require("../libtextmode/libtextmode");

// The document palette stores 6-bit VGA values (0-63) per channel. The UI
// presents and edits 8-bit values (0-255), converting on the way in and out.
let palette = [];
let selected = 0;
let swatch_divs = [];

function $(name) {
    return document.getElementById(name);
}

function send(channel, opts) {
    electron.ipcRenderer.send(channel, {id: remote.getCurrentWindow().getParentWindow().id, ...opts});
}

function send_parent(channel, opts) {
    remote.getCurrentWindow().getParentWindow().send(channel, opts);
}

function to_8bit(rgb) {
    return {
        r: libtextmode.convert_6bits_to_8bits(rgb.r),
        g: libtextmode.convert_6bits_to_8bits(rgb.g),
        b: libtextmode.convert_6bits_to_8bits(rgb.b)
    };
}

function byte_to_hex(value) {
    return value.toString(16).toUpperCase().padStart(2, "0");
}

function build_swatches() {
    const swatches = $("swatches");
    swatches.innerHTML = "";
    swatch_divs = palette.map((rgb, i) => {
        const div = document.createElement("div");
        div.classList.add("palette_swatch");
        div.style.backgroundColor = libtextmode.convert_ega_to_style(rgb);
        div.addEventListener("mousedown", () => select(i));
        swatches.appendChild(div);
        return div;
    });
}

function update_swatch(i) {
    swatch_divs[i].style.backgroundColor = libtextmode.convert_ega_to_style(palette[i]);
}

function update_selection_highlight() {
    swatch_divs.forEach((div, i) => div.classList.toggle("selected", i == selected));
}

function update_sliders(skip_field) {
    const {r, g, b} = to_8bit(palette[selected]);
    const values = {red: r, green: g, blue: b};
    for (const channel of ["red", "green", "blue"]) {
        $(channel).value = values[channel];
        // Don't overwrite the number field the user is currently typing into,
        // otherwise lossy 6-bit rounding clobbers multi-digit entry.
        if (`${channel}_value` != skip_field) $(`${channel}_value`).value = values[channel];
    }
    if (skip_field != "hex") $("hex").value = `#${byte_to_hex(r)}${byte_to_hex(g)}${byte_to_hex(b)}`;
    $("preview").style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
}

function select(i) {
    selected = i;
    update_selection_highlight();
    update_sliders();
}

const channel_keys = {red: "r", green: "g", blue: "b"};

function set_channel(channel, value_8bit, skip_field) {
    value_8bit = Math.max(0, Math.min(255, value_8bit | 0));
    palette[selected][channel_keys[channel]] = libtextmode.convert_8bits_to_6bits(value_8bit);
    update_swatch(selected);
    update_sliders(skip_field);
}

function slider_input(channel) {
    set_channel(channel, parseInt($(channel).value, 10));
}

function number_input(channel) {
    const value = parseInt($(`${channel}_value`).value, 10);
    if (!isNaN(value)) set_channel(channel, value, `${channel}_value`);
}

function hex_input() {
    const match = /^#?([0-9a-fA-F]{6})$/.exec($("hex").value.trim());
    if (!match) {
        $("hex").classList.add("illegal");
        return;
    }
    $("hex").classList.remove("illegal");
    const hex = match[1];
    const rgb = palette[selected];
    rgb.r = libtextmode.convert_8bits_to_6bits(parseInt(hex.substr(0, 2), 16));
    rgb.g = libtextmode.convert_8bits_to_6bits(parseInt(hex.substr(2, 2), 16));
    rgb.b = libtextmode.convert_8bits_to_6bits(parseInt(hex.substr(4, 2), 16));
    update_swatch(selected);
    update_sliders();
}

function ok() {
    send_parent("update_palette", {palette});
    send("close_modal");
}

function cancel() {
    send("close_modal");
}

function reset() {
    send_parent("reset_palette", {});
    send("close_modal");
}

document.addEventListener("DOMContentLoaded", () => {
    $("ok").addEventListener("click", () => ok(), true);
    $("cancel").addEventListener("click", () => cancel(), true);
    $("reset").addEventListener("click", () => reset(), true);
    for (const channel of ["red", "green", "blue"]) {
        $(channel).addEventListener("input", () => slider_input(channel), true);
        $(`${channel}_value`).addEventListener("input", () => number_input(channel), true);
    }
    $("hex").addEventListener("input", () => hex_input(), true);
}, true);

document.addEventListener("keydown", (event) => {
    if (document.activeElement && (document.activeElement.id == "hex" || document.activeElement.type == "number")) {
        if (event.code == "Escape") cancel();
        return;
    }
    if (event.code == "Enter" || event.code == "NumpadEnter") {
        ok();
    } else if (event.code == "Escape") {
        cancel();
    }
}, true);

electron.ipcRenderer.on("edit_palette", (event, opts) => {
    // Work on a private clone so cancelling leaves the document untouched.
    palette = opts.palette.map((rgb) => ({r: rgb.r, g: rgb.g, b: rgb.b}));
    selected = 0;
    build_swatches();
    update_selection_highlight();
    update_sliders();
});

electron.ipcRenderer.on("ok", () => ok());
electron.ipcRenderer.on("cancel", () => cancel());
