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
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const AppDisplay = imports.ui.appDisplay;

var ANIMATION_DIRECTION = {
    IN: 0,
    OUT: 1
};

var INDICATORS_BASE_TIME = 0.25;
var INDICATORS_ANIMATION_DELAY = 0.125;
var INDICATORS_ANIMATION_MAX_TIME = 0.75;
var INDICATORS_BASE_TIME_OUT = 0.125;
var INDICATORS_ANIMATION_DELAY_OUT = 0.0625;
var INDICATORS_ANIMATION_MAX_TIME_OUT = INDICATORS_ANIMATION_MAX_TIME;
var VIEWS_SWITCH_ANIMATION_DELAY = 0.1;

var PageIndicators = new Lang.Class({
    Name: 'HowDoIPageIndicators',
    Extends: AppDisplay.PageIndicators,

    _init: function() {
        this.actor = new AppDisplay.PageIndicatorsActor();
        this.actor.set_vertical(false);
        this.actor.x_align = Clutter.ActorAlign.CENTER;
        this.actor.y_align = Clutter.ActorAlign.CENTER;

        this._nPages = 0;
        this._currentPage = undefined;
    },

    animate_indicators: function(animation_direction) {
        if(!this.actor.mapped) return;
        let children = this.actor.get_children();
        if(children.length == 0) return;

        for(let i = 0; i < this.n_pages; i++) Tweener.removeTweens(children[i]);

        let offset;

        if(this.actor.get_text_direction() == Clutter.TextDirection.RTL) {
            offset = -children[0].height;
        }
        else {
            offset = children[0].height;
        }

        let is_animation_in = animation_direction == ANIMATION_DIRECTION.IN;
        let delay = (
            is_animation_in ?
            INDICATORS_ANIMATION_DELAY :
            INDICATORS_ANIMATION_DELAY_OUT
        );
        let base_time = (
            is_animation_in ?
            INDICATORS_BASE_TIME :
            INDICATORS_BASE_TIME_OUT
        );
        let total_animation_time = base_time + delay * this.n_pages;
        let max_time = (
            is_animation_in ?
            INDICATORS_ANIMATION_MAX_TIME :
            INDICATORS_ANIMATION_MAX_TIME_OUT
        );

        if(total_animation_time > max_time) {
            delay -= (total_animation_time - max_time) / this.n_pages;
        }

        for(let i = 0; i < this.n_pages; i++) {
            let child = children[i];
            child.translation_y = is_animation_in ? offset : 0;
            Tweener.addTween(child, {
                translation_y: is_animation_in ? 0 : offset,
                time: base_time + delay * i,
                transition: 'easeInOutQuad',
                delay: is_animation_in ? VIEWS_SWITCH_ANIMATION_DELAY : 0
            });
        }
    },

    destroy: function() {
        this.actor.destroy();
    },

    set n_pages(pages) {
        this.setNPages(pages);
        this.emit('notify::n-pages');
    },

    get n_pages() {
        return this._nPages;
    },

    set current_page(page) {
        this.setCurrentPage(page);
        this.emit('notify::current-page');
    },

    get current_page() {
        return this._currentPage;
    }
});
Signals.addSignalMethods(PageIndicators.prototype);
