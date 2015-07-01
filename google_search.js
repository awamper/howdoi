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

const LINK_REGEXP = /<h3 class="r"><a href="([\s\S]*?)"[\s\S]*?<\/a>/ig;
const SEARCH_URL = 'https://www.google.com/search?q=site:%s %s';

const GoogleSearch = new Lang.Class({
    Name: 'HowDoIGoogleSearch',

    _init: function() {
        this._site = null;
    },

    _build_url: function(query) {
        let url = SEARCH_URL.format(this._site, encodeURIComponent(query));
        return url;
    },

    _set_random_agent: function() {
        let agent = Utils.USER_AGENTS[Math.floor(Math.random() * Utils.USER_AGENTS.length)];
        Utils.HTTP_SESSION.user_agent = agent;
    },

    _parse_links: function(html) {
        let result = [];
        let match;

        while((match = LINK_REGEXP.exec(html)) !== null) {
            result.push(match[1]);
        }

        return result;
    },

    get_links: function(query, callback) {
        if(Utils.is_blank(query)) callback(false, null);

        this._set_random_agent();
        let url = this._build_url(query);
        let message = Soup.Message.new('GET', url);
        Utils.HTTP_SESSION.queue_message(message,
            Lang.bind(this, function(http_session, response) {
                Utils.HTTP_SESSION.user_agent = Utils.DEFAULT_USER_AGENT;

                if(response.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        'GoogleSearch:get_links(): Error: code %s, reason %s'.format(
                            response.status_code,
                            response.reaseon_phrase
                        );
                    callback(false, error_message);
                    return;
                }

                let links = this._parse_links(response.response_body.data);
                callback(links);
            })
        );
    },

    destroy: function() {
        Utils.HTTP_SESSION.user_agent = Utils.DEFAULT_USER_AGENT;
    },

    set site(site) {
        this._site = site;
    },

    get site() {
        return site;
    }
});
