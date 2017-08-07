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
const Indicator = Me.imports.indicator;

let howdoi = null;
let indicator = null;
let settings_connection_id = 0;

function add_keybindings() {
    Main.wm.addKeybinding(
        PrefsKeys.SHOW_HOWDOI,
        Utils.SETTINGS,
        Meta.KeyBindingFlags.NONE,
        Shell.ActionMode.NORMAL |
        Shell.ActionMode.OVERVIEW,
        Lang.bind(this, function() {
            howdoi.toggle();
        })
    );
}

function remove_keybindings() {
    Main.wm.removeKeybinding(PrefsKeys.SHOW_HOWDOI);
}

function enable_indicator() {
    if(indicator === null) {
        indicator = new Indicator.Indicator();
    }
}

function disable_indicator() {
    if(indicator !== null) {
        indicator.destroy();
        indicator = null;
    }
}

function init() {
    // nothing
}

function enable() {
    if(howdoi === null) {
        howdoi = new HowDoI.HowDoI();
    }
    add_keybindings();

    if(Utils.SETTINGS.get_boolean(PrefsKeys.INDICATOR)) {
        enable_indicator();
    }

    settings_connection_id = Utils.SETTINGS.connect(
        'changed::' + PrefsKeys.INDICATOR,
        Lang.bind(this, function() {
            if(Utils.SETTINGS.get_boolean(PrefsKeys.INDICATOR)) {
                enable_indicator();
            }
            else {
                disable_indicator();
            }
        })
    );
}

function disable() {
    Utils.SETTINGS.disconnect(settings_connection_id);
    settings_connection_id = 0;

    disable_indicator();
    remove_keybindings();

    if(howdoi !== null) {
        howdoi.destroy();
        howdoi = null;
    }
}
