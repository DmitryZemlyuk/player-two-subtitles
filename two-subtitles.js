(function () {
    'use strict';

    function startPlugin(){
        window.dual_subtitles_plugin = true;

        $('body').append(
            '<style>' +
            '.player-video__subtitles2{position:absolute;left:0;right:0;top:8%;text-align:center;' +
            'z-index:3;pointer-events:none}' +
            '.player-video__subtitles2>div{display:inline-block;background:rgba(0,0,0,.55);color:#fff;' +
            'padding:.3em .6em;border-radius:.3em;font-size:1.5em;line-height:1.3;' +
            'text-shadow:0 0 .2em rgba(0,0,0,.6);max-width:80%;white-space:normal}' +
            '</style>'
        );

        var cues2       = [];
        var overlay2    = null;
        var currentSubs = [];

        function parseTime(str){
            var m = /(\d+):(\d{2}):(\d{2})[.,](\d{3})/.exec(str);
            if(!m) return 0;
            return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+m[4]);
        }

        function stripTags(text){
            return text.replace(/<[^>]+>/g, '');
        }

        function parseSubs(data){
            data = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            var lines  = data.split('\n');
            var cues   = [];
            var timeRe = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;
            var i = 0;

            while(i < lines.length){
                var m = timeRe.exec(lines[i]);

                if(m){
                    var start = parseTime(m[1]);
                    var end   = parseTime(m[2]);
                    var text  = [];

                    i++;

                    while(i < lines.length && lines[i].trim() !== ''){
                        text.push(stripTags(lines[i]));
                        i++;
                    }

                    cues.push({ start: start, end: end, text: text.join('\n') });
                }

                i++;
            }

            return cues;
        }

        function renderCue(text){
            if(!overlay2) return;

            if(text) overlay2.find('> div').html(text.replace(/\n/g, '<br>')).css('display', 'inline-block');
            else overlay2.find('> div').html('').css('display', 'none');
        }

        var sizeObserver = null;

        function baseEmFromClasses(cls){
            cls = cls || '';
            if(cls.indexOf('size--large') > -1) return 3;
            if(cls.indexOf('size--small') > -1) return 2;
            return 2.5;
        }

        function updateSecondSize(mainEl){
            if(!overlay2 || !mainEl) return;

            var base = baseEmFromClasses(mainEl.className || '');

            overlay2.find('> div').css('font-size', (base * 0.75) + 'em');
        }

        function ensureOverlay(){
            var render = Lampa.PlayerVideo.render();
            var main   = render.find('.player-video__subtitles');

            overlay2 = render.find('.player-video__subtitles2');

            if(!overlay2.length){
                overlay2 = $('<div class="player-video__subtitles2"><div></div></div>');
                main.after(overlay2);
            }

            if(main.length){
                updateSecondSize(main[0]);

                if(sizeObserver) sizeObserver.disconnect();

                if(window.MutationObserver){
                    sizeObserver = new MutationObserver(function(){
                        updateSecondSize(main[0]);
                    });

                    sizeObserver.observe(main[0], { attributes: true, attributeFilter: ['class'] });
                }
            }
        }

        function loadSecondTrack(url){
            cues2 = [];
            renderCue('');

            if(!url) return;

            $.get(url).done(function(data){
                cues2 = parseSubs(data);
            }).fail(function(){
                console.log('dual-subtitles', 'ошибка загрузки', url);
                Lampa.Noty.show('Не удалось загрузить вторую дорожку субтитров');
            });
        }

        function pickSecondTrack(){
            if(!currentSubs.length){
                Lampa.Noty.show('Для этого видео нет доступных дорожек субтитров');
                return;
            }

            var enabled = Lampa.Controller.enabled ? Lampa.Controller.enabled().name : 'player_panel';

            var items = currentSubs.map(function(s){
                return { title: s.label || s.name || 'Subtitle', url: s.url };
            });

            items.unshift({ title: 'Выключить вторую дорожку', url: '' });

            Lampa.Select.show({
                title: 'Вторая дорожка субтитров',
                items: items,
                onSelect: function(a){
                    Lampa.Storage.set('dual_subs_second_url', a.url);
                    loadSecondTrack(a.url);
                    Lampa.Controller.toggle(enabled);
                },
                onBack: function(){
                    Lampa.Controller.toggle(enabled);
                }
            });
        }

        Lampa.Player.listener.follow('start', function(data){
            currentSubs = data.subtitles || [];

            ensureOverlay();

            var saved = Lampa.Storage.get('dual_subs_second_url', '');

            if(saved && currentSubs.some(function(s){ return s.url === saved; })){
                loadSecondTrack(saved);
            }
        });

        Lampa.PlayerVideo.listener.follow('timeupdate', function(e){
            if(!cues2.length) return;

            var t      = (e.current || 0) * 1000;
            var active = null;

            for(var i = 0; i < cues2.length; i++){
                if(t >= cues2[i].start && t <= cues2[i].end){
                    active = cues2[i];
                    break;
                }
            }

            renderCue(active ? active.text : '');
        });

        Lampa.Player.listener.follow('ready', function(){
            var render = Lampa.Player.render();

            if(render.find('.dual-subs-button').length) return;

            var icon =
                '<svg width="25" height="27" viewBox="0 0 25 27" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M22.4357 20.0861C20.1515 23.0732 16.5508 25 12.5 25C5.59644 25 0 19.4036 0 12.5C0 5.59644 5.59644 0 12.5 0C16.5508 0 20.1515 1.9268 22.4357 4.9139L18.8439 7.84254C17.2872 6.09824 15.0219 5 12.5 5C7.80558 5 5 7.80558 5 12.5C5 17.1944 7.80558 20 12.5 20C15.0219 20 17.2872 18.9018 18.8439 17.1575L22.4357 20.0861Z" fill="currentColor"></path>' +
                '<text x="24" y="26" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="currentColor" text-anchor="end">2</text>' +
                '</svg>';

            var btn = $('<div class="dual-subs-button selector button" title="Вторая дорожка субтитров">' + icon + '</div>');

            (render.find('.player-panel__subs').length ? render.find('.player-panel__subs') : render.find('.player-panel__right')).after(btn);

            btn.on('hover:enter', pickSecondTrack);
        });
    }

    if(!window.dual_subtitles_plugin){
        if(window.appready) startPlugin();
        else Lampa.Listener.follow('app', function(e){ if(e.type == 'ready') startPlugin(); });
    }
})();