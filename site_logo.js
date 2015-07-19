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
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Extension = Me.imports.extension;

const ENTER_ANIMATION_TIME = 0.8;
const LEAVE_ANIMATION_TIME = 0.8;
const SCALE_ANIMATION_TIME = 0.3;

const MIN_SCALE = 0.7;

const SiteLogo = new Lang.Class({
    Name: 'HowDoISiteLogo',

    _init: function(site_info) {
        this.actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style_class: 'howdoi-site-logo-box',
            scale_x: MIN_SCALE,
            scale_y: MIN_SCALE
        });
        this.actor.set_pivot_point(0.5, 0.5);
        this.actor.connect('enter-event',
            Lang.bind(this, this._on_enter)
        );
        this.actor.connect('leave-event',
            Lang.bind(this, this._on_leave)
        );
        this.actor.connect('button-release-event',
            Lang.bind(this, this._on_button_release)
        );

        this._logo_box = new St.Bin();
        this._label = new St.Label({
            style_class: 'howdoi-site-logo-label',
            opacity: 100
        });
        this.actor.add(this._logo_box, {
            expand: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START,
            x_fill: false,
            y_fill: false
        });
        this.actor.add(this._label, {
            expand: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START,
            x_fill: false,
            y_fill: false
        });

        this._desaturate_effect = new Clutter.DesaturateEffect();
        this._desaturate_effect.set_factor(1);
        this.actor.add_effect(this._desaturate_effect);

        this.site_info = null;

        if(site_info) this.set_site(site_info);
    },

    _on_enter: function() {
        global.screen.set_cursor(Meta.Cursor.POINTING_HAND);

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            scale_x: 1,
            scale_y: 1,
            time: SCALE_ANIMATION_TIME,
            transition:'easeOutQuad'
        });

        Tweener.removeTweens(this._desaturate_effect);
        Tweener.addTween(this._desaturate_effect, {
            factor: 0,
            time: ENTER_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });

        Tweener.removeTweens(this._label);
        Tweener.addTween(this._label, {
            opacity: 255,
            time: ENTER_ANIMATION_TIME,
            transition: 'easeOutQuad'
        })
    },

    _on_leave: function() {
        global.screen.set_cursor(Meta.Cursor.DEFAULT);

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            scale_x: MIN_SCALE,
            scale_y: MIN_SCALE,
            time: SCALE_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });

        Tweener.removeTweens(this._desaturate_effect);
        Tweener.addTween(this._desaturate_effect, {
            factor: 1,
            time: LEAVE_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });

        Tweener.removeTweens(this._label);
        Tweener.addTween(this._label, {
            opacity: 100,
            time: LEAVE_ANIMATION_TIME,
            transition:'easeOutQuad'
        })
    },

    _on_button_release: function() {
        Gio.app_info_launch_default_for_uri(
            this.site_info.site_url,
            Utils.make_launch_context()
        );
        Extension.howdoi.hide();
    },

    set_site: function(site_info) {
        this.site_info = site_info;
        if(this._logo_box.child) this._logo_box.child.destroy();
        let scale_factor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let image_file = Gio.file_new_for_uri(site_info.logo_url);
        let texture_cache = St.TextureCache.get_default();
        let image = texture_cache.load_file_async(image_file, -1, -1, scale_factor);
        this._logo_box.set_child(image);
        this._label.set_text(site_info.audience);
    },

    destroy: function() {
        this.site_info = null;
        this.actor.destroy();
    }
});
