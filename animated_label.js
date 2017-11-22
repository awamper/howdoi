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
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PopupDialog = Me.imports.popup_dialog;

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.7;
const MIN_OPACITY = 0;
const ANIMATION_TIME = 0.4;
const ANIMATION_DELAY = 0.9;

var AnimatedLabel = new Lang.Class({
    Name: 'HowDoIAnimatedLabel',
    Extends: PopupDialog.PopupDialog,

    _init: function(text) {
        this.parent({
            style_class: 'howdoi-animated-label',
            modal: false
        });
        this.actor.set_pivot_point(0.5, 0.5);

        let label = new St.Label({
            text: text
        });
        label.clutter_text.set_max_length(200);
        this.actor.add_child(label);
    },

    show: function(actor=null, x=null, y=null) {
        if(actor === null && (x === null || y === null)) {
            [x, y] = global.get_pointer();
        }
        else if(actor) {
            [x, y] = actor.get_transformed_position();
        }

        this._reposition(x, y);

        this.actor.set_scale(MIN_SCALE, MIN_SCALE);
        this.actor.set_opacity(MIN_OPACITY);
        this.actor.show();

        Tweener.addTween(this.actor, {
            time: ANIMATION_TIME,
            scale_x: 1,
            scale_y: 1,
            opacity: 255,
            transition: 'easeInExpo',
            onComplete: Lang.bind(this, function() {
                Tweener.addTween(this.actor, {
                    delay: ANIMATION_DELAY,
                    time: ANIMATION_TIME,
                    scale_x: MAX_SCALE,
                    scale_y: MAX_SCALE,
                    opacity: 0,
                    transition: 'easeInExpo',
                    onComplete: Lang.bind(this, function() {
                        this.destroy();
                    })
                });
            })
        });
    }
});

function flash(text, actor, x, y) {
    let animated_label = new AnimatedLabel(text);
    animated_label.show(actor, x, y);
}
