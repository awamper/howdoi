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
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const AnswerView = Me.imports.answer_view;
const PageIndicators = Me.imports.page_indicators;

const PAGE_SWITCH_TIME = 0.3;
const RESULTS_ANIMATION_TIME = 0.3;

const ICON_ANIMATION_TIME = 0.2;
const ICON_MIN_OPACITY = 30;
const ICON_MAX_OPACITY = 255;

const AnswersView = new Lang.Class({
    Name: 'HowDoIAnswersView',

    _init: function() {
        this.actor = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            vertical: true,
            reactive: true
        });
        this.actor.connect('scroll-event',
            Lang.bind(this, this._on_scroll)
        );
        this.actor.connect('allocation-changed',
            Lang.bind(this, this._on_allocation_changed)
        );

        this._scroll_view = new St.ScrollView({
            style_class: 'howdoi-answers-view-scroll',
            x_expand: true,
            y_expand: true,
            x_fill: true,
            y_fill: true
        });
        this._scroll_view.set_policy(
            Gtk.PolicyType.EXTERNAL,
            Gtk.PolicyType.EXTERNAL
        );

        this._table = new St.Table();
        this._table.add(this._scroll_view, {
            row: 0,
            col: 0
        })
        this.actor.add(this._table, {
            expand: true,
            x_fill: true,
            y_fill: true
        });

        this._box = new St.BoxLayout({
            vertical: false,
            style_class: 'howdoi-answers-view-box'
        });
        this._scroll_view.add_actor(this._box);

        this._page_indicators = new PageIndicators.PageIndicators();
        this._page_indicators.connect('page-activated',
            Lang.bind(this, function(indicators, page_index) {
                this.show_page(page_index);
            })
        );
        this._page_indicators.connect('notify::n-pages',
            Lang.bind(this, function() {
                if(this._page_indicators.n_pages <= 1) {
                    this._prev_btn.hide();
                    this._next_btn.hide();
                }
                else {
                    this._prev_btn.show();
                    this._next_btn.show();
                }
            })
        );
        this._page_indicators.connect('notify::current-page',
            Lang.bind(this, function() {
                if(this._page_indicators.n_pages <= 1) return;

                if(this.current_page >= this._page_indicators.n_pages - 1) {
                    this._next_btn.add_style_pseudo_class('disabled');
                }
                else {
                    this._next_btn.remove_style_pseudo_class('disabled');
                }

                if(this.current_page === 0) {
                    this._prev_btn.add_style_pseudo_class('disabled');
                }
                else {
                    this._prev_btn.remove_style_pseudo_class('disabled')
                }
            })
        );

        if(!Utils.SETTINGS.get_boolean(PrefsKeys.HIDE_PAGE_INDICATORS)) {
            this._table.add(this._page_indicators.actor, {
                row: 1,
                col: 0
            });
        }

        this._adjustment = this._scroll_view.hscroll.adjustment;
        this._shown = false;
        this._answer_views = [];
        this._current_page = 0;
        this._animation_running = false;

        let prev_icon = new St.Icon({
            icon_name: 'go-previous-symbolic'
        });
        this._prev_btn = new St.Button({
            child: prev_icon,
            style_class: 'howdoi-next-page-button',
            visible: false
        });
        this._prev_btn.connect('clicked',
            Lang.bind(this, this.prev_page)
        );
        this._table.add(this._prev_btn, {
            row: 0,
            col: 0,
            row_span: 2,
            expand: true,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });

        let next_icon = new St.Icon({
            icon_name: 'go-next-symbolic'
        });
        this._next_btn = new St.Button({
            child: next_icon,
            style_class: 'howdoi-prev-page-button',
            visible: false
        });
        this._next_btn.connect('clicked',
            Lang.bind(this, this.next_page)
        );
        this._table.add(this._next_btn, {
            row: 0,
            col: 0,
            row_span: 2,
            expand: true,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.MIDDLE
        });

        this._background_icon = new St.Icon({
            icon_name: 'face-cool-symbolic',
            style_class: 'howdoi-answers-view-icon',
            opacity: ICON_MAX_OPACITY
        });
        this._table.add(this._background_icon, {
            row: 0,
            col: 0,
            row_span: 2,
            expand: true,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this._resize_icons();
    },

    _on_allocation_changed: function() {
        this._resize_answer_views();
        this._resize_icons();
    },

    _on_scroll: function(actor, event) {
        let direction = event.get_scroll_direction();

        if(direction == Clutter.ScrollDirection.UP) this.prev_page();
        else if(direction == Clutter.ScrollDirection.DOWN) this.next_page();

        return Clutter.EVENT_STOP;
    },

    _resize_icons: function() {
        let allocation_box = this.actor.get_allocation_box();
        let width = allocation_box.x2 - allocation_box.x1;
        let height = allocation_box.y2 - allocation_box.y1;

        this._background_icon.icon_size = Math.round(height * 0.7);
        this._prev_btn.child.icon_size = Math.round(height * 0.1);
        this._next_btn.child.icon_size = Math.round(height * 0.1);
    },

    _resize_answer_views: function() {
        for each(let view in this._answer_views) {
            this._resize_answer_view(view);
        }
    },

    _resize_answer_view: function(answer_view) {
        let allocation = this.actor.get_allocation_box();
        let actor_width = allocation.x2 - allocation.x1;
        let actor_height = allocation.y2 - allocation.y1;

        answer_view.set_width(Math.round(actor_width * 0.9));
        answer_view.set_height(Math.round(actor_height * 0.8));
    },

    _add_answer: function(answer_text) {
        let answer_view = new AnswerView.AnswerView(answer_text);
        this._resize_answer_view(answer_view);
        this._box.add(answer_view.actor, {
            expand: true,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this._answer_views.push(answer_view);
        this.emit('notify::n-results');
    },

    _clear_animation_done: function() {
        this._animation_running = false;
        this._scroll_view.opacity = 255;
        for each(let answer_view in this._answer_views) answer_view.destroy();
        this._answer_views = [];
        this._page_indicators.n_pages = 0;
        this.current_page = 0;
        this.emit('notify::n-results');
    },

    _hide_icon: function() {
        if(this._background_icon.opacity === ICON_MIN_OPACITY) return;

        Tweener.removeTweens(this._background_icon);
        Tweener.addTween(this._background_icon, {
            opacity: ICON_MIN_OPACITY,
            time: RESULTS_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
    },

    _show_icon: function() {
        if(this._background_icon.opacity === ICON_MAX_OPACITY) return;

        Tweener.removeTweens(this._background_icon);
        Tweener.addTween(this._background_icon, {
            opacity: ICON_MAX_OPACITY,
            time: RESULTS_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
    },

    set_answers: function(answer_texts) {
        if(this._animation_running) {
            Tweener.removeTweens(this._scroll_view);
            this._scroll_view.opacity = 255;
            this._animation_running = false;
            this._hide_icon();
        }

        if(typeof answer_texts === 'string') {
            if(!Utils.is_blank(answer_texts)) answer_texts = [answer_texts];
            else answer_texts = [];
        }

        let prev_n_results = this.n_results;
        this.clear(answer_texts.length === 0);

        for each(let answer_text in answer_texts) {
            if(Utils.is_blank(answer_text)) continue;
            this._add_answer(answer_text);
        }

        this.current_page = 0;
        this._page_indicators.n_pages = answer_texts.length;
        this._page_indicators.current_page = this.current_page;

        if(!this.active_answer || prev_n_results > 0) return;

        this._hide_icon();
        this._page_indicators.animate_indicators(PageIndicators.ANIMATION_DIRECTION.IN);
        this.active_answer.actor.opacity = 0;
        this.active_answer.actor.show();

        Tweener.addTween(this.active_answer.actor, {
            opacity: 255,
            time: RESULTS_ANIMATION_TIME,
            transition: 'easeOutQuad'
        });
    },

    clear: function(animate_out) {
        if(this._answer_views.length < 1) return;

        animate_out = (
            animate_out === undefined
            ? false
            : animate_out
        );

        if(animate_out) {
            this._animation_running = true;
            this._show_icon();
            this._page_indicators.animate_indicators(
                PageIndicators.ANIMATION_DIRECTION.OUT
            );
            Tweener.removeTweens(this._scroll_view);
            Tweener.addTween(this._scroll_view, {
                opacity: 0,
                time: RESULTS_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: Lang.bind(this, this._clear_animation_done)
            });
        }
        else {
            this._clear_animation_done();
        }
    },

    show_page: function(page_index) {
        let answer_view = this._answer_views[page_index];
        if(!answer_view) return;

        let diff_to_page = Math.abs(this._adjustment.value - answer_view.actor.x);
        let box = this._scroll_view.get_allocation_box();
        let total_height = box.y2 - box.y1;
        let time = PAGE_SWITCH_TIME * diff_to_page / total_height;
        time = Math.min(time, PAGE_SWITCH_TIME);

        Tweener.removeTweens(this._adjustment);
        Tweener.addTween(this._adjustment, {
            time: time,
            value: answer_view.actor.x,
            transition: 'easeOutQuad'
        });

        this.current_page = page_index;
        this._page_indicators.current_page = page_index;
    },

    next_page: function() {
        let next_index = this.current_page + 1;
        if(next_index >= this._page_indicators.n_pages) return false;
        this.show_page(next_index);
        return true;
    },

    prev_page: function() {
        let prev_index = this.current_page - 1;
        if(prev_index < 0) return false;
        this.show_page(prev_index);
        return true;
    },

    destroy: function() {
        this.clear();
        this._page_indicators.destroy();
        this.actor.destroy();
    },

    set shown(shown) {
        this._shown = shown;
    },

    get shown() {
        return this._shown;
    },

    get active_answer() {
        return this._answer_views[this.current_page] || false;
    },

    set current_page(page_index) {
        this._current_page = page_index;
    },

    get current_page() {
        return this._current_page;
    },

    get n_results() {
        return this._answer_views.length;
    }
});
Signals.addSignalMethods(AnswersView.prototype);
