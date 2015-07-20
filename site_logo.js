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
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Extension = Me.imports.extension;

const ENTER_ANIMATION_TIME = 0.8;
const LEAVE_ANIMATION_TIME = 0.8;
const SCALE_ANIMATION_TIME = 0.2;
const TRANSLATION_ANIMATION_TIME = 0.3;

const MIN_SCALE = 0.9;
const MAX_DESATURATE = 0.7;
const LABEL_MIN_OPACITY = 150;

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

        let box = new St.BoxLayout({
            vertical: true
        });

        this._scroll = new St.ScrollView();
        this._scroll.set_policy(
            Gtk.PolicyType.EXTERNAL,
            Gtk.PolicyType.EXTERNAL
        );
        this._scroll.add_actor(box);

        this._name = new St.Label({
            style_class: 'howdoi-site-logo-name',
            scale_x: MIN_SCALE,
            scale_y: MIN_SCALE
        });
        this._name.set_pivot_point(0.5, 0.5);

        this._audience = new St.Label({
            style_class: 'howdoi-site-logo-audience',
            opacity: LABEL_MIN_OPACITY
        });

        box.add(this._name, {
            expand: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START,
            x_fill: false,
            y_fill: false
        });
        box.add(this._audience, {
            expand: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START,
            x_fill: false,
            y_fill: false
        });

        this.actor.add_child(this._scroll);

        this._desaturate_effect = new Clutter.DesaturateEffect();
        this._desaturate_effect.set_factor(MAX_DESATURATE);
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

        Tweener.removeTweens(this._name);
        Tweener.addTween(this._name, {
            delay: SCALE_ANIMATION_TIME,
            scale_y: 1,
            scale_x: 1,
            time: SCALE_ANIMATION_TIME,
            transition: 'easeOutBack'
        });

        Tweener.removeTweens(this._audience);
        Tweener.addTween(this._audience, {
            opacity: 255,
            time: ENTER_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
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
            factor: MAX_DESATURATE,
            time: LEAVE_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });

        Tweener.removeTweens(this._name);
        Tweener.addTween(this._name, {
            scale_y: MIN_SCALE,
            scale_x: MIN_SCALE,
            time: SCALE_ANIMATION_TIME,
            transition: 'easeInBack'
        });

        Tweener.removeTweens(this._audience);
        Tweener.addTween(this._audience, {
            opacity: LABEL_MIN_OPACITY,
            time: LEAVE_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
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

        if(!Utils.is_blank(this._name.text)) {
            Tweener.removeTweens(this._desaturate_effect);
            Tweener.removeTweens(this.actor);
            Tweener.removeTweens(this._name);
            Tweener.removeTweens(this._audience);

            Tweener.addTween(this._name, {
                translation_x: -this.actor.width,
                time: TRANSLATION_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: Lang.bind(this, function() {
                    this._name.translation_x = this.actor.width;
                    this._name.set_text(site_info.name);

                    Tweener.addTween(this._name, {
                        translation_x: 0,
                        time: TRANSLATION_ANIMATION_TIME,
                        transition: 'easeOutQuad'
                    });
                })
            });

            Tweener.addTween(this._audience, {
                translation_x: -this.actor.width,
                time: TRANSLATION_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: Lang.bind(this, function() {
                    this._audience.translation_x = this.actor.width;
                    this._audience.set_text(site_info.audience);

                    Tweener.addTween(this._audience, {
                        translation_x: 0,
                        time: TRANSLATION_ANIMATION_TIME,
                        transition: 'easeOutQuad'
                    });
                })
            });
        }
        else {
            this._name.set_text(site_info.name);
            this._audience.set_text(site_info.audience);
        }
    },

    destroy: function() {
        this.site_info = null;
        this.actor.destroy();
    }
});
