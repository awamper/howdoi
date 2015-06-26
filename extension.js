/*
    Copyright 2015 Ivan awamper@gmail.com

    This program is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public License as
    published by the Free Software Foundation; either version 2 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const HowDoI = Me.imports.howdoi;
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;

let howdoi = null;

function add_keybindings() {
    Main.wm.addKeybinding(
        PrefsKeys.SHOW_HOWDOI,
        Utils.SETTINGS,
        Meta.KeyBindingFlags.NONE,
        Shell.ActionMode.NORMAL |
        Shell.ActionMode.MESSAGE_TRAY |
        Shell.ActionMode.OVERVIEW,
        Lang.bind(this, function() {
            howdoi.toggle();
        })
    );
}

function remove_keybindings() {
    Main.wm.removeKeybinding(PrefsKeys.SHOW_HOWDOI);
}

function init() {
    // nothing
}

function enable() {
    if(howdoi === null) {
        howdoi = new HowDoI.HowDoI();
    }

    add_keybindings();
}

function disable() {
    remove_keybindings();

    if(howdoi !== null) {
        howdoi.destroy();
        howdoi = null;
    }
}
