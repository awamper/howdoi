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
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const SearchEntry = Me.imports.search_entry;
const AnswersView = Me.imports.answers_view;
const AnswersProvider = Me.imports.answers_provider;
const ProgressBar = Me.imports.progress_bar;
const StackExchangeSites = Me.imports.stackexchange_sites;
const SiteLogo = Me.imports.site_logo;

const CONNECTION_IDS = {
    CAPTURED_EVENT: 0
};
const TIMEOUT_IDS = {
    LOAD_CACHE: 0
};

const CACHE_TIMEOUT = 200;
const SHOW_ANIMATION_TIME = 0.15;
const HIDE_ANIMATION_TIME = 0.15;

const HowDoI = new Lang.Class({
    Name: 'HowDoI',

    _init: function() {
        this.actor = new St.Widget({
            style_class: 'howdoi-main-box',
            visible: false,
            layout_manager: new Clutter.TableLayout()
        });
        this.actor.set_pivot_point(0.5, 0.5);
        this.actor.connect(
            'key-press-event',
            Lang.bind(this, this._on_key_press_event)
        );

        this._answers_provider = new AnswersProvider.AnswersProvider();

        this._search_entry = new SearchEntry.SearchEntry();
        this._search_entry.connect(
            'activate',
            Lang.bind(this, function(search_entry) {
                this._search(this._search_entry.query);
            })
        );
        this._search_entry.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._on_entry_text_changed)
        );
        this._search_entry.clutter_text.connect(
            'key-press-event',
            Lang.bind(this, this._on_entry_key_press_event)
        );
        this._search_entry.actor.hide();
        this.actor.layout_manager.pack(this._search_entry.actor, 0, 0);

        this._progress_bar = new ProgressBar.ProgressBar({
            box_style_class: 'howdoi-progress-bar-box',
            progress_style_class: 'howdoi-progress-bar',
        });
        this._progress_bar.hide();
        this.actor.layout_manager.pack(this._progress_bar.actor, 0, 0);

        this._answers_view = new AnswersView.AnswersView();
        this._answers_view.page_indicators.connect(
            'notify::current-page',
            Lang.bind(this, function() {
                this._search_entry.grab_key_focus(true);
            })
        );
        this.actor.layout_manager.pack(this._answers_view.actor, 0, 1);

        this._background_actor = new St.BoxLayout({
            style_class: 'howdoi-background'
        });

        this._site_logo = new SiteLogo.SiteLogo();
        this._background_actor.add(this._site_logo.actor, {
            expand: true,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.START,
            y_align: St.Align.END
        });

        let preferences_icon = new St.Icon({
            icon_name: 'preferences-system-symbolic',
            style_class: 'howdoi-control-button',
            reactive: true,
            track_hover: true
        });
        preferences_icon.connect('button-release-event',
            Lang.bind(this, function() {
                Utils.launch_extension_prefs(Me.uuid);
                this.hide();
            })
        );
        this._background_actor.add(preferences_icon, {
            expand: true,
            x_fill: false,
            x_align: St.Align.END,
            y_fill: false,
            y_align: St.Align.END
        });

        this._ignore_entry_change = false;
        this._shown = false;
        this._keywords = JSON.parse(Utils.SETTINGS.get_string(
            PrefsKeys.KEYWORDS
        ));
        this._current_site = null;

        Utils.SETTINGS.connect(
            'changed::' + PrefsKeys.KEYWORDS,
            Lang.bind(this, function() {
                this._keywords = JSON.parse(Utils.SETTINGS.get_string(
                    PrefsKeys.KEYWORDS
                ));
            })
        );
        Utils.SETTINGS.connect(
            'changed::' + PrefsKeys.DEFAULT_SITE_ID,
            Lang.bind(this, function() {
                let site_info = StackExchangeSites.LIST[
                    Utils.SETTINGS.get_int(PrefsKeys.DEFAULT_SITE_ID)
                ];
                if(!site_info) return;
                this.set_site(site_info);
            })
        );

        let current_site_id = Utils.SETTINGS.get_int(
            PrefsKeys.DEFAULT_SITE_ID
        );
        this.set_site(StackExchangeSites.LIST[current_site_id]);
    },

    _on_key_press_event: function(sender, event) {
        let code = event.get_key_code();
        let symbol = event.get_key_symbol();
        let control = event.has_control_modifier();
        let shift = event.has_shift_modifier();
        let alt = (event.get_state() & Clutter.ModifierType.MOD1_MASK)
        let ch = Utils.get_unichar(symbol);

        if(symbol === Clutter.Escape) {
            if(this._search_entry.suggestions.shown) {
                this._search_entry.suggestions.hide(false);
            }
            else {
                this.hide();
            }
        }
        // <Ctrl>V
        else if(code === 55 && control) {
            St.Clipboard.get_default().get_text(
                St.ClipboardType.CLIPBOARD,
                Lang.bind(this, function(clipboard, text) {
                    if(Utils.is_blank(text)) return;
                    this._search_entry.grab_key_focus(true);
                    this._search_entry.suggestions.ignore_change = true;
                    this._search_entry.set_text(text);
                    this._search(this._search_entry.query);
                })
            );
        }
        // <Ctrl><Shift>C
        else if(code === 54 && control && shift) {
            if(this._answers_view.n_results < 1) return Clutter.EVENT_STOP;
            let code = this._answers_view.active_answer.answer.all_code;

            if(!Utils.is_blank(code)) {
                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    code
                );
            }
        }
        // <Ctrl><Alt>C
        else if(code === 54 && control && alt) {
            if(this._answers_view.n_results < 1) return Clutter.EVENT_STOP;
            let code = this._answers_view.active_answer.answer.first_code;

            if(!Utils.is_blank(code)) {
                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    code
                );
            }
        }
        // <Ctrl>S
        else if(code === 39 && control) {
            if(this._answers_view.n_results > 0) {
                if(this._answers_view.view_mode_btn.checked) {
                    this._answers_view.view_mode_btn.checked = false;
                }
                else {
                    this._answers_view.view_mode_btn.checked = true;
                }

                this._answers_view.on_view_mode_clicked();
            }
        }
        else if(ch) {
            this._search_entry.grab_key_focus(false);
            this._search_entry.set_text(ch);
        }
        else if(symbol === Clutter.Up) {
            if(!this._search_entry.suggestions.shown) {
                this._search_entry.history_prev();
                this._search_entry.grab_key_focus();
            }
        }
        else if(symbol === Clutter.Down) {
            if(!this._search_entry.suggestions.shown) {
                this._search_entry.history_next();
                this._search_entry.grab_key_focus();
            }
        }

        return Clutter.EVENT_STOP;
    },

    _on_entry_key_press_event: function(sender, event) {
        let symbol = event.get_key_symbol();
        let control = event.has_control_modifier();

        if(control && symbol === Clutter.Right) {
            this._answers_view.next_page();
            return Clutter.EVENT_STOP;
        }
        else if(control && symbol === Clutter.Left) {
            this._answers_view.prev_page();
            return Clutter.EVENT_STOP;
        }
        else if(control && symbol === Clutter.Up) {
            let active_answer = this._answers_view.active_answer
            if(active_answer) this._answers_view.active_answer.scroll_step_up();
            return Clutter.EVENT_STOP;
        }
        else if(control && symbol === Clutter.Down) {
            let active_answer = this._answers_view.active_answer;
            if(active_answer) active_answer.scroll_step_down();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _on_entry_text_changed: function() {
        this._remove_timeout();

        if(this.ignore_change) {
            this.ignore_change = true;
            return Clutter.EVENT_PROPAGATE;
        }

        this._answers_view.clear(false);
        this._set_site_for_text(this._search_entry.text)

        TIMEOUT_IDS.LOAD_CACHE = Mainloop.timeout_add(CACHE_TIMEOUT,
            Lang.bind(this, function() {
                TIMEOUT_IDS.LOAD_CACHE = 0;
                let cached = this._answers_provider.get_cache(
                    this._search_entry.keyword,
                    this._search_entry.query
                );
                if(cached) {
                    this._answers_view.set_answers(cached);
                    this._answers_view.show_label(
                        this._answers_view.cached_label
                    );
                }

                return GLib.SOURCE_REMOVE;
            })
        );

        return Clutter.EVENT_PROPAGATE;
    },

    _set_site_for_text: function(text) {
        if(Utils.is_blank(text)) {
            this.reset_site();
            return;
        }

        let keyword = this.get_keyword_for_query(text);
        if(!keyword) {
            this.reset_site();
            return;
        }

        let site_name = this._get_name_for_keyword(keyword);
        if(site_name === -1) {
            this.reset_site();
            return;
        }

        if(this._current_site.name !== site_name) {
            this.set_site(this._get_site_by_name(site_name));
        }
    },

    _get_name_for_keyword: function(keyword) {
        let result = -1;

        for (let site_name in this._keywords) {
            if(this._keywords[site_name] === keyword) {
                result = site_name;
                break;
            }
        }

        return result;
    },

    _get_site_by_name: function(name) {
        let result = -1;

        for each(let site in StackExchangeSites.LIST) {
            if(site.name === name) result = site;
        }

        return result;
    },

    _search: function(query) {
        if(Utils.is_blank(query)) return;

        this._progress_bar.pulse_mode = true;
        this._progress_bar.start();
        this._progress_bar.show();

        let no_cache = this._answers_view.cached_label.visible;
        let max_answers = Utils.SETTINGS.get_int(PrefsKeys.MAX_ANSWERS);
        this._answers_provider.get_answers(
            this._search_entry.keyword,
            query,
            max_answers,
            no_cache,
            Lang.bind(this, function(answers, error) {
                this._progress_bar.stop();
                this._progress_bar.hide();

                if(answers === null) {
                    log(error);
                    return;
                }

                this._answers_view.set_answers(answers);
            })
        );
    },

    _resize: function() {
        let monitor = Main.layoutManager.currentMonitor;
        let is_primary = monitor.index === Main.layoutManager.primaryIndex;

        let available_width = monitor.width;
        let available_height = monitor.height;
        if(is_primary) available_height -= Main.panel.actor.height;

        let width_percents = Utils.SETTINGS.get_int(PrefsKeys.DIALOG_WIDTH_PERCENTS);
        let width = Math.round(available_width / 100 * width_percents);
        let height_pecents = Utils.SETTINGS.get_int(PrefsKeys.DIALOG_HEIGHT_PERCENTS);
        let height = Math.round(available_height / 100 * height_pecents);

        let padding = (
            this.actor.get_theme_node().get_padding(St.Side.LEFT) +
            this.actor.get_theme_node().get_padding(St.Side.RIGHT)
        );
        let border_width = (
            this._search_entry.actor.get_theme_node().get_border_width(St.Side.LEFT) +
            this._search_entry.actor.get_theme_node().get_border_width(St.Side.RIGHT)
        );
        let shadow_offset = 4;

        this.actor.set_width(width);
        this.actor.set_height(height);
        this._progress_bar.actor.set_width(width - padding - shadow_offset);
    },

    _reposition: function() {
        let monitor = Main.layoutManager.currentMonitor;
        this.actor.x = Math.round(monitor.width / 2 - this.actor.width / 2);
        this.actor.y = Math.round(monitor.height / 2 - this.actor.height / 2);
    },

    _connect_captured_event: function() {
        CONNECTION_IDS.CAPTURED_EVENT =
            global.stage.connect(
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

    _on_captured_event: function(sender, event) {
        if(event.type() === Clutter.EventType.BUTTON_RELEASE) {
            let pointer_outside = !Utils.is_pointer_inside_actor(this.actor);
            if(pointer_outside) this.hide();
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _show_background: function() {
        if(this._background_actor.visible) return;

        this._background_actor.width = Main.uiGroup.width;
        this._background_actor.height = Main.uiGroup.height;
        Main.uiGroup.add_child(this._background_actor);

        if(Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)) {
            this._background_actor.set_opacity(0);
            this._background_actor.show();

            Tweener.removeTweens(this._background_actor);
            Tweener.addTween(this._background_actor, {
                time: SHOW_ANIMATION_TIME,
                opacity: 255
            });
        }
        else {
            this._background_actor.show();
        }
    },

    _hide_background: function() {
        if(!this._background_actor.visible) return;

        if(Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)) {
            Tweener.removeTweens(this._background_actor);
            Tweener.addTween(this._background_actor, {
                time: HIDE_ANIMATION_TIME,
                opacity: 0,
                onComplete: Lang.bind(this, function() {
                    this._background_actor.hide();
                    this._background_actor.set_opacity(255);
                    Main.uiGroup.remove_child(this._background_actor);
                })
            })
        }
        else {
            this._background_actor.hide();
            Main.uiGroup.remove_child(this._background_actor);
        }
    },

    _show_done: function() {
        this.shown = true;

        Main.pushModal(this.actor, {
            actionMode: Shell.ActionMode.NORMAL
        });
        this._connect_captured_event();

        if(!this._search_entry.is_empty()) {
            this._search_entry.grab_key_focus(true);
        }
    },

    _hide_done: function() {
        this.shown = false;
        if(Main._findModal(this.actor) !== -1) Main.popModal(this.actor);
        this._disconnect_captured_event();
    },

    _remove_timeout: function() {
        if(TIMEOUT_IDS.LOAD_CACHE > 0) {
            Mainloop.source_remove(TIMEOUT_IDS.LOAD_CACHE);
            TIMEOUT_IDS.LOAD_CACHE = 0;
        }
    },

    get_keyword_for_query: function(query='') {
        if(Utils.is_blank(query) && Utils.is_blank(this._search_entry.text)) {
            return false;
        }

        query = Utils.is_blank(query) ? this._search_entry.text : query;
        let result = false;
        let space_index = query.indexOf(' ');

        if(space_index === -1) return result;

        let keyword = query.slice(0, space_index);
        keyword = keyword.trim();

        let site_name = this._get_name_for_keyword(keyword);
        if(site_name !== -1) result = keyword;

        return result;
    },

    show: function(animation) {
        if(this.shown) return;

        this.emit('showing');
        this._show_background();
        animation =
            animation === undefined
            ? Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)
            : animation;

        Main.uiGroup.add_child(this.actor);
        this._resize();
        this._reposition();

        if(!animation) {
            this.actor.show();
            this._search_entry.actor.opacity = 255;
            this._search_entry.actor.show();
            this._show_done();
            return;
        }

        this.actor.set_pivot_point(0.5, 1.0);
        this.actor.scale_x = 0.01;
        this.actor.scale_y = 0.05;
        this.actor.opacity = 0;
        this.actor.show();

        this._search_entry.actor.opacity = 0;
        this._search_entry.actor.show();

        this._answers_view.actor.set_scale(0.8, 0.8);
        this._answers_view.actor.set_pivot_point(0.5, 0.5);

        Tweener.removeTweens(this.actor)
        Tweener.addTween(this.actor, {
            opacity: 255,
            scale_x: 1,
            scale_y: 1,
            time: SHOW_ANIMATION_TIME,
            transition: 'easeOutExpo',
            onComplete: Lang.bind(this, this._show_done)
        });

        Tweener.removeTweens(this._search_entry.actor);
        Tweener.addTween(this._search_entry.actor, {
            delay: Math.round(SHOW_ANIMATION_TIME * 0.8),
            time: 0.8,
            opacity: 255,
            transition: 'easeOutQuad'
        });

        Tweener.removeTweens(this._answers_view.actor);
        Tweener.addTween(this._answers_view.actor, {
            delay: Math.round(SHOW_ANIMATION_TIME * 0.8),
            time: 0.2,
            scale_x: 1.1,
            scale_y: 1.1,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                Tweener.addTween(this._answers_view.actor, {
                    time: 0.2,
                    scale_x: 1,
                    scale_y: 1,
                    transition: 'easeOutQuad'
                });
            })
        });
    },

    set_site: function(site_info) {
        this._answers_provider.site = site_info;
        this._current_site = site_info;
        this._site_logo.set_site(site_info);
    },

    reset_site: function() {
        let default_site = StackExchangeSites.LIST[
            Utils.SETTINGS.get_int(PrefsKeys.DEFAULT_SITE_ID)
        ];
        if(this._current_site.name !== default_site.name) {
            this.set_site(default_site);
        }
    },

    hide: function(animation) {
        if(!this.shown) return;

        this.emit('closing');
        this._hide_background();
        animation =
            animation === undefined
            ? Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)
            : animation;

        if(!animation) {
            this.actor.hide();
            Main.uiGroup.remove_child(this.actor);
            this._hide_done();
            return;
        }

        this.actor.set_pivot_point(0.5, 0.5);

        Tweener.removeTweens(this._search_entry.actor);
        Tweener.addTween(this._search_entry.actor, {
            transition: 'easeOutQuad',
            opacity: 0,
            time: 0.4
        });

        Tweener.removeTweens(this._answers_view.actor);
        Tweener.addTween(this._answers_view.actor, {
            time: 0.1,
            scale_x: 1.05,
            scale_y: 1.05,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                Tweener.addTween(this._answers_view.actor, {
                    time: 0.1,
                    scale_x: 1,
                    scale_y: 1,
                    transition: 'easeOutQuad'
                });
            })
        });

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            delay: 0.2,
            opacity: 0,
            scale_x: 0.8,
            scale_y: 0.8,
            time: HIDE_ANIMATION_TIME,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                this._search_entry.actor.hide();
                this._search_entry.actor.set_opacity(255);

                this.actor.hide();
                this.actor.set_scale(1, 1);
                this.actor.set_opacity(255);
                Main.uiGroup.remove_child(this.actor);

                this._hide_done();
            })
        });
    },

    toggle: function() {
        if(this.shown) this.hide();
        else this.show();
    },

    show_cache_or_search: function() {
        this._set_site_for_text(this._search_entry.text);

        let cached = this._answers_provider.get_cache(
            this._search_entry.keyword,
            this._search_entry.query
        );
        if(cached) {
            this._answers_view.set_answers(cached);
            this._answers_view.show_label(
                this._answers_view.cached_label
            );
        }
        else {
            this._search(this._search_entry.query);
        }
    },

    destroy: function() {
        this._remove_timeout();
        Utils.HTTP_CACHE.dump();
        this._disconnect_captured_event();
        this._site_logo.destroy();
        this._progress_bar.destroy();
        this._background_actor.destroy();
        this._answers_provider.destroy();
        this._answers_view.destroy();
        this._search_entry.destroy();
        this.actor.destroy();
    },

    set shown(shown) {
        this._shown = shown;
        this.emit('shown-changed', this.shown);
    },

    get shown() {
        return this._shown;
    },

    get search_entry() {
        return this._search_entry;
    },

    set ignore_change(ignore) {
        this._ignore_entry_change = ignore;
    },

    get ignore_change() {
        return this._ignore_entry_change;
    },

    get answers_view() {
        return this._answers_view;
    }
});
Signals.addSignalMethods(HowDoI.prototype);
