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
const PrefsKeys = Me.imports.prefs_keys;

const SUGGESTION_TYPE = {
    QUERY: 'QUERY',
    NAVIGATION: 'NAVIGATION',
    CALCULATOR: 'CALCULATOR'
};

const GoogleSuggestions = new Lang.Class({
    Name: 'GoogleSuggestions',

    _init: function() {
        // nothing
    },

    _build_url: function(query) {
        let url = Utils.SETTINGS.get_string(PrefsKeys.GOOGLE_SUGGESTIONS_URL);
        url = url.format(encodeURIComponent(query));
        return url;
    },

    _parse_response: function(data) {
        if(data[1].length < 1) return [];

        let suggestions = [];

        for(let i = 0; i < data[1].length; i++) {
            let text = data[1][i].trim();
            let type = data[4]['google:suggesttype'][i].trim();
            let relevance = parseInt(
                data[4]['google:suggestrelevance'][i]
            );
            let proceed = (
                !Utils.is_blank(text) &&
                !Utils.is_blank(type) &&
                relevance > 0
            );
            if(!proceed) continue;

            let suggestion = {
                text: text,
                type: type,
                relevance: relevance
            }
            suggestions.push(suggestion);
        }

        return suggestions;
    },

    get_suggestions: function(query, types, limit, callback) {
        if(Utils.is_blank(query)) {
            callback(query, null, 'Query is empty.');
            return;
        }

        let url = this._build_url(query);
        let message = Soup.Message.new('GET', url);
        Utils.HTTP_SESSION.queue_message(message,
            Lang.bind(this, function(http_session, response) {
                if(response.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        'GoogleSuggestions:get_suggestions(): Error: code %s, reason %s'.format(
                            response.status_code,
                            response.reaseon_phrase
                        );
                    callback(query, null, error_message);
                    return;
                }

                let json;

                try {
                    json = JSON.parse(response.response_body.data);
                    let suggestions = this._parse_response(json);

                    if(types !== null && types.length > 0) {
                        suggestions = suggestions.filter(
                            function(suggestion) {
                                return types.indexOf(suggestion.type) !== -1;
                            }
                        );
                    }

                    if(limit > 0) suggestions = suggestions.splice(0, limit);
                    callback(query, suggestions);
                }
                catch(e) {
                    let error_message = 'GoogleSuggestions:get_suggestions(): %s'.format(e);
                    callback(query, null, error_message);
                }
            })
        );
    },

    destroy: function() {
        // nothing
    }
});
