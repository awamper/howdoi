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
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const PULSE_TIMEOUT_MS = 30;

const ProgressBar = new Lang.Class({
    Name: 'HowDoIProgressBar',

    _init: function(params) {
        this._params = Params.parse(params, {
            box_style_class: '',
            progress_style_class: '',
            animation_time: 0.7,
            pulse_mode: false
        });

        this.actor = new St.Widget({
            style_class: this._params.box_style_class,
            layout_manager: new Clutter.TableLayout()
        });
        this.actor.set_x_align(Clutter.ActorAlign.CENTER);
        this.actor.set_y_align(Clutter.ActorAlign.START);
        this.actor.set_x_expand(true);
        this.actor.set_y_expand(false);

        this._pulse_mode = this._params.pulse_mode;
        this._pulse_step = 1;
        this._reverse_pulse = false;
        this._pulse_source_id = 0;
        this._percents = 0;
        this._box_padding_width = null;

        this.hide_on_finish = false;
        this.visible = true;

        this._progress_bar = new St.BoxLayout({
            style_class: this._params.progress_style_class
        });
        this._progress_bar.set_x_align(Clutter.ActorAlign.START);
        this._progress_bar.set_y_align(Clutter.ActorAlign.FILL);
        this._progress_bar.set_x_expand(true);
        this._progress_bar.set_y_expand(false);

        this.actor.layout_manager.pack(this._progress_bar, 0, 0);
        this.reset();
    },

    _get_box_padding_width: function() {
        if(this._box_padding_width !== null) {
            return this._box_padding_width;
        }

        let box_theme_node = this.actor.get_theme_node();
        let box_left_padding = box_theme_node.get_padding(St.Side.LEFT);
        let box_right_padding = box_theme_node.get_padding(St.Side.RIGHT);

        this._box_padding_width = box_left_padding + box_right_padding;
        return this._box_padding_width;
    },

    _pulse: function() {
        let x;

        if(this._reverse_pulse) {
            x = this._progress_bar.translation_x - this._pulse_step;
            if(x <= 0) this._reverse_pulse = false;
        }
        else {
            let padding_width = this._get_box_padding_width();
            let max_x = (
                this.actor.width -
                this._progress_bar.width -
                padding_width
            );

            x = this._progress_bar.translation_x + this._pulse_step;
            if(x >= max_x) this._reverse_pulse = true;
        }

        this._progress_bar.translation_x = x;
        return GLib.SOURCE_CONTINUE;
    },

    set_progress_percents: function(percents) {
        this._percents = percents;

        let box_theme_node = this.actor.get_theme_node();
        let box_border = box_theme_node.get_length('border');
        let padding_width = this._get_box_padding_width();

        let max_width = (
            this.actor.width -
            box_border -
            padding_width
        );
        let width = Math.min(Math.round(
            this.actor.width / 100 * percents -
            box_border -
            padding_width
        ), max_width);

        if(width < 1) return;

        Tweener.removeTweens(this._progress_bar);
        Tweener.addTween(this._progress_bar, {
            time: this._params.animation_time,
            transition: 'easeOutQuad',
            width: width,
            onComplete: Lang.bind(this, function() {
                if(this.percents >= 100 && this.hide_on_finish) this.hide();
            })
        });
    },

    reset: function() {
        this._box_padding_width = null;
        this._progress_bar.width = 0;
        this._percents = 0;
        this.stop();
    },

    destroy: function() {
        this.stop();
        this.actor.destroy();
        this._params = null;
    },

    start: function() {
        if(!this.pulse_mode) return;

        this._progress_bar.width = Math.round(this.actor.width / 5);
        this._pulse_step = Math.round(this._progress_bar.width / 10)
        this._pulse_source_id = Mainloop.timeout_add(
            PULSE_TIMEOUT_MS,
            Lang.bind(this, this._pulse)
        );
    },

    stop: function() {
        this._progress_bar.width = 0;
        this._progress_bar.translation_x = 0;
        this._reverse_pulse = false;

        if(this._pulse_source_id !== 0) {
            Mainloop.source_remove(this._pulse_source_id);
            this._pulse_source_id = 0;
        }
    },

    show: function() {
        if(this.visible) return;

        this.visible = true;
        this.actor.opacity = 0;
        this.actor.show();

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            time: 0.3,
            transition: 'easeOutQuad',
            opacity: 255
        });
    },

    hide: function() {
        if(!this.visible) return;

        this.visible = false;

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            time: 0.3,
            transition: 'easeOutQuad',
            opacity: 0,
            onComplete: Lang.bind(this, function() {
                this.actor.hide();
                this.stop();
            })
        });
    },

    get pulse_mode() {
        return this._pulse_mode;
    },

    set pulse_mode(pulse_mode) {
        this.reset();
        this._pulse_mode = pulse_mode;
    },

    get percents() {
        return this._percents;
    },

    set percents(percents) {
        this.set_progress_percents(percents);
    }
});
