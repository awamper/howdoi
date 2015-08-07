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

const St = imports.gi.St;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const Shell = imports.gi.Shell;
const Tweener = imports.ui.tweener;
const Params = imports.misc.params;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const CONNECTION_IDS = {
    CAPTURED_EVENT: 0
};

const MIN_SCALE = 0.8;

const PopupDialog = new Lang.Class({
    Name: 'PopupDialog',

    _init: function(params) {
        this.params = Params.parse(params, {
            style_class: '',
            modal: false
        });
        this.actor = new St.BoxLayout({
            style_class: this.params.style_class,
            visible: false
        });
        this.actor.set_pivot_point(0.5, 0.5);

        this._event_blocker = null;
        this._modal_mode = null;

        Main.uiGroup.add_child(this.actor);

        if(this.params.modal) {
            this.enable_modal();
        }

        this._shown = false;
        this._hiding = false;
    },

    _reposition: function(x, y) {
        if(!x || !y) [x, y] = global.get_pointer();

        let offset_x = 0;
        let offset_y = 0;

        let monitor = Main.layoutManager.currentMonitor;
        let available_width =
            (monitor.width + monitor.x) - x;
        let available_height =
            (monitor.height + monitor.y) - y;

        if(this.actor.width > available_width) {
            offset_x =
                (monitor.width + monitor.x) - (this.actor.width + x);
        }
        if(this.actor.height > available_height) {
            offset_y =
                (monitor.height + monitor.y) - (this.actor.height + y);
        }

        let dialog_x = x + offset_x;
        let dialog_y = y + offset_y;

        if(x > dialog_x && y > dialog_y) {
            dialog_x = x - this.actor.width;
        }

        this.actor.x = dialog_x;
        this.actor.y = dialog_y;
    },

    _connect_captured_event: function() {
        CONNECTION_IDS.CAPTURED_EVENT = global.stage.connect(
            'captured-event',
            Lang.bind(this, this._on_captured_event)
        );
    },

    _disconnect_captured_event: function() {
        if(CONNECTION_IDS.CAPTURED_EVENT > 0) {
            global.stage.disconnect(CONNECTION_IDS.CAPTURED_EVENT);
            CONNECTION_IDS.CAPTURED_EVENT = 0;
        }
    },

    _on_captured_event: function(object, event) {
        if(event.type() === Clutter.EventType.BUTTON_RELEASE) {
            let [x, y, mods] = global.get_pointer();
            let pointer_outside = !Utils.is_pointer_inside_actor(this.actor);
            if(pointer_outside) this.hide();
        }
        else if(event.type() === Clutter.EventType.KEY_RELEASE) {
            let symbol = event.get_key_symbol();
            if(symbol === Clutter.Escape) this.hide();
        }
    },

    _show_done: function() {
        if(this._modal_mode) {
            Main.pushModal(this.actor, {
                keybindingMode: Shell.KeyBindingMode.NORMAL
            });
        }
        if(this._event_blocker) this._event_blocker.show();
        this._connect_captured_event();
    },

    _hide_done: function() {
        if(this._event_blocker) {
            this._event_blocker.hide();
        }

        if(this._modal_mode && Main._findModal(this.actor) !== -1) {
            Main.popModal(this.actor);
        }

        this.hiding = false;
        this._disconnect_captured_event();
    },

    show: function(animation) {
        if(this.shown && !this.hiding) return;
        if(this.hiding) Tweener.removeTweens(this.actor);

        this._reposition();

        Main.uiGroup.set_child_above_sibling(this.actor, null);
        this.actor.set_opacity(0);
        this.actor.set_scale(MIN_SCALE, MIN_SCALE);
        this.actor.show();

        animation =
            animation === undefined
            ? true
            : animation;

        if(!animation) {
            this.actor.set_opacity(255);
            this.actor.set_scale(1, 1);
            this._show_done();
            this.shown = true;
            return;
        }

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 255,
            scale_x: 1,
            scale_y: 1,
            time: 0.3,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                this._show_done();
                this.shown = true;
            })
        });
    },

    hide: function(animation) {
        // if(!this.shown) return;

        animation =
            animation === undefined
            ? true
            : animation;
        this.hiding = true;

        if(!animation) {
            this.actor.hide();
            this.actor.set_scale(1, 1);
            this.actor.set_opacity(255);
            this._hide_done();
            this.shown = false;
            return;
        }

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 0,
            scale_x: MIN_SCALE,
            scale_y: MIN_SCALE,
            time: 0.3,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                this.actor.hide();
                this.actor.set_scale(1, 1);
                this.actor.set_opacity(255);
                this._hide_done();
                this.shown = false;
            })
        });
    },

    enable_modal: function() {
        if(this._modal_mode) return;

        this._modal_mode = true;
        this._event_blocker = new St.Bin({
            opacity: 0,
            x: Main.uiGroup.x,
            y: Main.uiGroup.y + Main.panel.actor.height,
            width: Main.uiGroup.width,
            height: Main.uiGroup.height - Main.panel.actor.height,
            reactive: true
        });
        this._event_blocker.hide();
        Main.uiGroup.insert_child_below(this._event_blocker, this.actor);

        if(this.shown) {
            Main.pushModal(this.actor, {
                actionMode: Shell.ActionMode.NORMAL
            });
            this._event_blocker.show();
        }
    },

    disable_modal: function() {
        if(!this._modal_mode) return;

        this._modal_mode = false;

        if(this._event_blocker) {
            this._event_blocker.destroy();
            this._event_blocker = null;
        }

        if(Main._findModal(this.actor) !== -1) {
            Main.popModal(this.actor);
        }
    },

    destroy: function() {
        this._disconnect_captured_event();
        this.actor.destroy();
        if(this._event_blocker) this._event_blocker.destroy();
    },

    get shown() {
        return this._shown;
    },

    set shown(shown) {
        this._shown = shown;
        this.emit('notify::shown', shown);
    },

    get hiding() {
        return this._hiding;
    },

    set hiding(hiding) {
        this._hiding = hiding;
    }
});
Signals.addSignalMethods(PopupDialog.prototype);
