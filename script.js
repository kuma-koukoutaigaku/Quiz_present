/* [最新版: script.js] */
// 英語音声の読み上げ (グローバルスコープ)
window.speakText = function (e, text) {
    if (e) e.stopPropagation();
    if (!text) return;
    const cleanText = text.replace(/[\u2700-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g, '').trim();
    if (!cleanText) return;
    const uttr = new SpeechSynthesisUtterance(cleanText);
    uttr.lang = 'en-US';
    uttr.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(uttr);
};

document.addEventListener('DOMContentLoaded', () => {
    const generatorUI = document.getElementById('generator-ui');
    const playerUI = document.getElementById('player-ui');
    const syncStatus = document.getElementById('sync-status');
    const tabSelector = document.getElementById('tab-selector-container');
    const tabButtons = document.getElementById('tab-buttons');
    const previewSection = document.getElementById('preview-section');
    const currentTabSpan = document.getElementById('current-tab-name');
    const copyBtn = document.getElementById('copy-link-btn');

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxNIk7TAcBDycadrKEhVYeHiMB_FyJ7bls80-Q6lDKJTqB6261I9CiS4lDroYWzjj71/exec';

    let currentGroupedData = {};
    let selectedTab = null;

    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('d');

    if (dataParam) {
        initPlayerMode(dataParam);
    } else {
        initGeneratorMode();
    }

    function initGeneratorMode() {
        syncStatus.style.display = 'flex';
        fetch(GAS_URL)
            .then(res => res.json())
            .then(rawData => {
                const grouped = {};
                rawData.forEach(item => {
                    const tabName = item['タブ'] || 'その他';
                    if (!grouped[tabName]) grouped[tabName] = [];
                    grouped[tabName].push({
                        m: item['問題タイプ'] || '',
                        c: item['カテゴリ'] || '',
                        i: item['指示文'] || '',
                        q: item['問題'] || '',
                        a: item['正解'] || '',
                        d1: item['ダミー1'] || '',
                        d2: item['ダミー2'] || '',
                        d3: item['ダミー3'] || '',
                        e: item['解説'] || '',
                        t: item['日本語訳'] || ''
                    });
                });
                currentGroupedData = grouped;
                renderTabButtons(Object.keys(grouped));
            })
            .catch(err => {
                console.error(err);
                syncStatus.innerHTML = '<p style="color:red;">データの取得に失敗しました。</p>';
            })
            .finally(() => {
                syncStatus.style.display = 'none';
                tabSelector.style.display = 'block';
            });

        function renderTabButtons(tabs) {
            tabButtons.innerHTML = tabs.map(tab => `<button class="tab-btn">${tab}</button>`).join('');
            tabButtons.querySelectorAll('.tab-btn').forEach((btn, i) => {
                btn.onclick = () => selectTab(tabs[i], btn);
            });
        }

        function selectTab(tab, btn) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTab = tab;
            currentTabSpan.textContent = tab;
            renderQuizList('preview-mount', currentGroupedData[tab], tab);
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

        const btnPc = document.getElementById('btn-pc');
        const btnMobile = document.getElementById('btn-mobile');
        const previewWrapper = document.getElementById('player-preview-wrapper');

        btnPc.onclick = () => {
            btnPc.classList.add('active');
            btnMobile.classList.remove('active');
            previewWrapper.classList.remove('mobile-view');
            previewWrapper.classList.add('pc-view');
        };
        btnMobile.onclick = () => {
            btnMobile.classList.add('active');
            btnPc.classList.remove('active');
            previewWrapper.classList.remove('pc-view');
            previewWrapper.classList.add('mobile-view');
        };

        copyBtn.onclick = () => {
            if (!selectedTab) return;

            if (window.location.protocol === 'file:') {
                alert('警告: 現在ローカルファイルとして開いています。GitHub上でこのボタンを押さないと、生成されたリンクは他のスマホでは開きません。');
            }

            const sourceData = currentGroupedData[selectedTab];
            const cleanData = sourceData.map(item => {
                const { _print, ...cleanItem } = item;
                return cleanItem;
            });

            const payload = { t: selectedTab, x: cleanData };
            const json = JSON.stringify(payload);
            const base64 = btoa(unescape(encodeURIComponent(json)));
            const baseUrl = window.location.href.split('?')[0];
            const shareUrl = `${baseUrl}?d=${encodeURIComponent(base64)}`;

            if (shareUrl.length > 8000) {
                alert('警告: 問題数が多すぎるため、一部のスマホアプリではリンクが開けない可能性があります。');
            }

            navigator.clipboard.writeText(shareUrl).then(() => alert('共有リンクをコピーしました！'));
        };
    }

    function initPlayerMode(encodedBase64) {
        try {
            const base64 = decodeURIComponent(encodedBase64);
            const json = decodeURIComponent(escape(atob(base64)));
            const payload = JSON.parse(json);
            const title = payload.t || 'Quiz List';
            const data = payload.x || [];

            document.body.classList.add('is-player');
            generatorUI.style.display = 'none';
            playerUI.style.display = 'block';
            document.getElementById('player-title').textContent = title;
            document.getElementById('quiz-total-count').textContent = data.length;

            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                playerUI.classList.add('mobile-view');
            }
            renderQuizList('list-mount', data, title);
        } catch (e) {
            console.error(e);
            alert('URLが正しくありません。');
        }
    }

    function renderQuizList(mountId, data, title = '') {
        const listMount = document.getElementById(mountId);
        if (!listMount) return;

        let html = '';
        if (title) html += `<div class="mobile-only-title">${esc(title)}</div>`;
        html += `<table class="player-table quiz-table">`;
        html += `<thead><tr><th class="td-no">NO.</th><th class="td-q">問題</th><th class="td-c">選択肢</th><th class="td-a">正解</th><th class="td-e">解説</th></tr></thead>`;
        html += `<tbody>`;

        let lastSectionKey = '';
        data.forEach((item, index) => {
            const currentSectionKey = `${item.c}|${item.i}`;
            if (currentSectionKey !== lastSectionKey) {
                html += `<tr class="section-row"><td colspan="5"><div class="section-title"><span class="section-cat">${esc(item.c || 'Category')}</span><span class="section-inst">${esc(item.i || '指示に従って答えよ')}</span></div></td></tr>`;
                lastSectionKey = currentSectionKey;
            }

            let displayQ = item.q;
            let displayA = item.a;
            const stripBrackets = (s) => (s ? String(s).replace(/\[\[|\]\]/g, '') : '');
            if (displayQ.includes('[')) {
                if (displayQ.includes(':')) {
                    const rawQ = displayQ;
                    displayQ = rawQ.replace(/\[\[?([^:\]]*?):[^\]]*?\]\]?/g, '$1');
                    displayA = rawQ.replace(/\[\[?[^:\]]*?:([^\]]*?)\]\]?/g, '$1');
                }
                displayQ = stripBrackets(displayQ);
                displayA = stripBrackets(displayA);
            }

            displayQ = formatQuestion(displayQ);
            let displayChoices = '';
            let explanation = item.e || '';
            if (item.t) explanation = `【日本語訳】\n${item.t}\n\n${explanation}`;
            explanation = stripBrackets(explanation);

            if (item.m === 'sort') {
                const baseStr = String(item.a);
                const blocks = baseStr.includes('/') ? baseStr.split('/') : baseStr.split(/\s+/);
                const shuffled = shuffle(blocks.filter(s => s.trim() !== ''));
                displayChoices = `<div class="anagram-box-container">${shuffled.map(unit => `<span>${esc(unit.trim())}</span>`).join('')}</div>`;
            } else if (item.m === 'anagram') {
                let sourceStr = String(item.a);
                if (String(item.q).includes('/')) sourceStr = String(item.q);
                const units = sourceStr.includes('/') ? sourceStr.split('/') : sourceStr.split('');
                const shuffled = shuffle(units.filter(s => s.trim() !== ''));
                displayQ = `<div class="anagram-box-container">${shuffled.map(u => `<span>${esc(u)}</span>`).join('')}</div>`;
                displayChoices = '';
            }

            const cat = String(item.c);
            const mode = String(item.m).toLowerCase();
            const isChoiceRequired = cat.includes('文法') || cat.includes('読解') || cat.includes('論理') || mode.includes('4choice') || mode.includes('listening');
            const isExcluded = cat.includes('単語') || cat.includes('熟語') || cat.includes('並び替え') || cat.includes('アナグラム') || cat.includes('フラッシュ') || mode.includes('sort') || mode.includes('anagram') || mode.includes('mistake');

            if (isChoiceRequired && !isExcluded && item.d1 && !displayChoices) {
                const choices = shuffle([item.a, item.d1, item.d2, item.d3]);
                displayChoices = `<div class="choice-grid">${choices.map(c => `<div class="choice-item" onclick="speakText(event, this.textContent)">${esc(c)}</div>`).join('')}</div>`;
            }

            const printItemData = { q: displayQ, a: displayA, e: explanation.trim() };
            html += `
                <tr id="item-${mountId}-${index}" class="quiz-item-row" onclick="revealItem('${mountId}', ${index})">
                    <td class="td-no">${index + 1}</td>
                    <td class="td-q">
                        <div class="mobile-item-inner">
                            <div class="mobile-q-row">
                                <span class="m-no">${index + 1}</span>
                                <span class="m-q" onclick="speakText(event, this.textContent)">${displayQ}</span>
                            </div>
                            \${displayChoices ? \`<div class="m-choices">\${displayChoices}</div>\` : ''}
                            <div class="m-reveal-area">
                                <div class="a-val" onclick="speakText(event, this.textContent)"><i class="ph ph-check-circle"></i> \${esc(displayA)}</div>
                                <div class="e-box">\${esc(explanation.trim())}</div>
                            </div>
                        </div>
                    </td>
                    <td class="td-c">\${displayChoices}</td>
                    <td class="td-a"><div class="a-val">\${esc(displayA)}</div></td>
                    <td class="td-e"><div class="e-box">\${esc(explanation.trim())}</div></td>
                </tr>
            \`;
            item._print = printItemData;
        });

        html += \`</tbody></table>\`;
        listMount.innerHTML = html;

        if (mountId === 'list-mount') {
            const printBody = document.getElementById('print-table-body');
            document.getElementById('print-title').textContent = title;
            printBody.innerHTML = data.map((item, i) => {
                const d = item._print || {q:'',a:'',e:''};
                return \`<tr><td>\${i+1}</td><td>\${d.q}</td><td><strong>\${esc(d.a)}</strong></td><td>\${esc(d.e)}</td></tr>\`;
            }).join('');
        }
    }

    window.revealItem = (mountId, idx) => {
        const item = document.getElementById(\`item-\${mountId}-\${idx}\`);
        if (!item) return;
        const isRevealed = item.classList.contains('revealed');
        document.querySelectorAll('.revealed').forEach(el => { if (el !== item) el.classList.remove('revealed'); });
        if (isRevealed) item.classList.remove('revealed');
        else item.classList.add('revealed');
    };

    const closeRevealed = () => document.querySelectorAll('.revealed').forEach(el => el.classList.remove('revealed'));
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => { if (Math.abs(window.scrollY - lastScrollY) > 20) { closeRevealed(); lastScrollY = window.scrollY; } }, { passive: true });

    function formatQuestion(q) {
        if (!q) return '';
        const hasJp = /[\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9faf]/.test(q);
        const splitIndex = q.search(/[A-Za-z(]/);
        if (hasJp && splitIndex > 0) {
            const line1 = q.substring(0, splitIndex).trim();
            const line2 = q.substring(splitIndex).trim();
            return \`<div>\${esc(line1)}</div><div style="font-size: 0.9em; color: var(--text-muted); margin-top: 4px;">\${esc(line2)}</div>\`;
        }
        return esc(q);
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : ''; }
});
