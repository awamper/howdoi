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
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const StackExchange = Me.imports.stack_exchange;
const GoogleSearch = Me.imports.google_search;
const Answer = Me.imports.answer;
const SimpleCache = Me.imports.simple_cache;

const QUESTION_ID_REGEXP = /\/questions\/(\d+)\//i;

const CONNECTION_IDS = {
    CACHE_LIMIT: 0
};

const AnswersProvider = new Lang.Class({
    Name: 'HowDoIAnswersProvider',

    _init: function() {
        this._limit = 3;
        this._site = null;

        this._stackexchange = new StackExchange.StackExchange();
        this._google_search = new GoogleSearch.GoogleSearch();

        let limit_key = PrefsKeys.ANSWERS_CACHE_LIMIT;
        let limit = Utils.SETTINGS.get_int(limit_key);
        if(limit === 0) {
            limit_key = PrefsKeys.HISTORY_LIMIT;
            limit = Utils.SETTINGS.get_int(limit_key);
        }

        this._cache = new SimpleCache.SimpleCache(limit);

        CONNECTION_IDS.CACHE_LIMIT = Utils.SETTINGS.connect(
            'changed::' + limit_key,
            Lang.bind(this, function() {
                this._cache.limit = Utils.SETTINGS.get_int(limit_key);
            })
        );
    },

    _get_ids_from_links: function(links) {
        let ids = [];

        for each(let link in links) {
            let match = QUESTION_ID_REGEXP.exec(link);
            if(match) ids.push(parseInt(match[1]));
        }

        return ids;
    },

    _get_question_ids: function(query, limit, callback) {
        if(Utils.SETTINGS.get_boolean(PrefsKeys.USE_GOOGLE_SEARCH)) {
            this._google_search.get_links(query,
                Lang.bind(this, function(links, error) {
                    if(links === null || links.length < 1) {
                        if(!Utils.is_blank(error)) log(error);
                        callback([]);
                        return;
                    }

                    let ids = this._get_ids_from_links(links);

                    if(ids.length < 1) {
                        callback([]);
                        return;
                    }
                    if(limit > 0) ids = ids.splice(0, limit);

                    callback(ids);
                })
            );
        }
        else {
            this._stackexchange.get_question_ids(query,
                Lang.bind(this, function(ids, error) {
                    if(ids === null || ids.length < 1) {
                        if(!Utils.is_blank(error)) log(error);
                        callback([]);
                    }
                    else {
                        if(limit > 0) ids = ids.splice(0, limit);
                        callback(ids);
                    }
                })
            );
        }
    },

    _load_answers: function(ids, answers) {
        let result = new Array(ids.length);

        for each(let answer in answers) {
            let index = ids.indexOf(parseInt(answer.question_id));
            if(index === -1) continue;
            result.splice(index, 0, new Answer.Answer(answer));
        }

        result = result.filter(function(n) { return n !== undefined });
        return result;
    },

    get_cache: function(query) {
        let result = false;
        let cached = this._cache.get(query.trim());

        if(cached) {
            result = this._load_answers(
                cached.ids,
                cached.answers
            );
        }

        return result;
    },

    get_answers: function(query, limit, callback) {
        if(limit === undefined) limit = this._limit;

        if(this.site === null) {
            let default_site_id = Utils.SETTINGS.get_int(
                PrefsKeys.DEFAULT_SITE_ID
            );
            let default_site = this._stackexchange.get_site(default_site_id);
            this._google_search.site = default_site.site_url;
            this._stackexchange.site = default_site.api_site_parameter;
        }

        let cached = this.get_cache(query);
        if(cached) {
            callback(cached);
            return;
        }

        this._get_question_ids(query, limit,
            Lang.bind(this, function(ids) {
                if(ids.length < 1) {
                    callback([]);
                    return;
                }

                this._stackexchange.get_answers(ids,
                    Lang.bind(this, function(answers, error) {
                        if(answers === null || answers.length < 1) {
                            if(!Utils.is_blank(error)) log(error);
                            callback([]);
                            return;
                        }

                        this._cache.add(query.trim(), {
                            ids: ids,
                            answers: answers
                        });
                        let result = this._load_answers(ids, answers);
                        callback(result);
                    })
                );
            })
        );
    },

    destroy: function() {
        Utils.SETTINGS.disconnect(CONNECTION_IDS.CACHE_LIMIT);
        CONNECTION_IDS.CACHE_LIMIT = 0;

        this._cache.destroy();
        this._stackexchange.destroy();
        this._google_search.destroy();
    },

    set site(site_info) {
        this._site = site_info;

        if(this._site !== null) {
            this._stackexchange.site = this._site.api_site_parameter;
            this._google_search.site = this._site.site_url;
        }
    },

    get site() {
        return this._site;
    }
});
