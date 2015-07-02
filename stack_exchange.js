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
const Soup = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const ANSWERS_FILTER = '!Fcazzsr2b3LgpofBVp)I3LvQBX';
const SEARCH_FILTER = '!)5IW-5Quf3(QZ8(H(ZGO3m1FuusY';

const API_KEY = '9NfesARrX27OlU2I*2m4xw((';
const API_URL_BASE = 'https://api.stackexchange.com/2.2/';
const API_ANSWERS = (
    API_URL_BASE +
    'questions/%s/answers?key=' + API_KEY +
    '&order=desc&sort=votes&site=%s&filter=' + ANSWERS_FILTER
);
const API_SEARCH = (
    API_URL_BASE +
    'search/advanced?key=' + API_KEY + '&filter=' + SEARCH_FILTER +
    '&pagesize=5&order=desc&sort=relevance&accepted=True&site=%s&q=%s'
);

const StackExchange = new Lang.Class({
    Name: 'HowDoIStackExchange',

    _init: function() {
        this._site = 'stackoverflow.com';
        this._quota_remaining = 1;
    },

    _parse_answers: function(json) {
        let temp = {};
        let answers = [];

        for each(let item in json.items) {
            if(item.is_accepted) {
                temp[item.question_id] = item;
                continue;
            }

            if(temp[item.question_id] === undefined) {
                temp[item.question_id] = item;
            }
            else if(temp[item.question_id].is_accepted) {
                continue;
            }
            else if(temp[item.question_id].score < item.score) {
                temp[item.question_id] = item;
            }
        }
        for each(let item in temp) answers.push(item);

        return answers;
    },

    _parse_ids: function(json) {
        let ids = [];

        json.items.sort(function(a, b) {
            return b.score - a.score;
        })
        for each(let item in json.items) {
            ids.push(item.question_id);
        }

        return ids;
    },

    get_answers: function(question_ids, callback) {
        if(this._quota_remaining < 1) {
            callback(null, 'Quota exceeded');
            return;
        }

        let url = API_ANSWERS.format(question_ids.join(';'), this.site);
        let message = Soup.Message.new('GET', url);
        Utils.HTTP_SESSION.queue_message(message,
            Lang.bind(this, function(http_session, response) {
                if(response.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        'StackExchange:get_answers(): Error: code %s'.format(
                            response.status_code
                        );
                    if(!Utils.is_blank(response.reason_phrase)) {
                        error_message += ', reason ' + response.reason_phrase;
                    }

                    callback(null, error_message);
                    return;
                }

                let json;

                try {
                    json = JSON.parse(response.response_body.data);
                }
                catch(e) {
                    callback(null, e.message + '\n' + e.stack);
                    return;
                }

                this._quota_remaining = json.quota_remaining;

                if(!Utils.is_blank(json.error_message)) {
                    callback(null, json.error_message);
                }
                else {
                    let answers = this._parse_answers(json);
                    callback(answers, null);
                }
            })
        );
    },

    get_question_ids: function(query, callback) {
        if(this._quota_remaining < 1) {
            callback(null, 'Quota exceeded');
            return;
        }

        let url = API_SEARCH.format(this.site, query);
        let message = Soup.Message.new('GET', url);
        Utils.HTTP_SESSION.queue_message(message,
            Lang.bind(this, function(http_session, response) {
                if(response.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        'StackExchange:get_question_ids(): Error: code %s'.format(
                            response.status_code
                        );
                    if(!Utils.is_blank(response.reason_phrase)) {
                        error_message += ', reason ' + response.reason_phrase;
                    }

                    callback(null, error_message);
                    return;
                }

                let json;

                try {
                    json = JSON.parse(response.response_body.data);
                }
                catch(e) {
                    callback(null, e.message + '\n' + e.stack);
                    return;
                }

                this._quota_remaining = json.quota_remaining;

                if(!Utils.is_blank(json.error_message)) {
                    callback(null, json.error_message);
                }
                else {
                    let ids = this._parse_ids(json);
                    callback(ids, null);
                }
            })
        );
    },

    destroy: function() {
        // nothing
    },

    set site(site) {
        this._site = site;
    },

    get site() {
        return this._site;
    }
});
