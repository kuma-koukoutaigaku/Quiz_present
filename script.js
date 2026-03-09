/* [script.js: URL短縮・GAS動的取得版] */

// 音声読み上げ
window.speakText = function (e, text) {
    if (e) e.stopPropagation();
    if (!text) return;
    const cleanText = text.replace(/[\u2700-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g, '').trim();
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
    const dataParam = urlParams.get('d'); // 旧互換
    const tabParam = urlParams.get('t');  // 新方式

    if (dataParam || tabParam) initPlayerMode(dataParam, tabParam);
    else initGeneratorMode();

    function initGeneratorMode() {
        fetchDataFromGAS().then(grouped => {
            currentGroupedData = grouped;
            tabButtons.innerHTML = Object.keys(grouped).map(tab => `<button class="tab-btn">${tab}</button>`).join('');
            tabButtons.querySelectorAll('.tab-btn').forEach((btn, i) => {
                btn.onclick = () => {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedTab = Object.keys(grouped)[i];
                    currentTabSpan.textContent = selectedTab;
                    renderQuizList('preview-mount', currentGroupedData[selectedTab], selectedTab);
                    previewSection.style.display = 'block';
                };
            });
        }).finally(() => {
            syncStatus.style.display = 'none';
            tabSelector.style.display = 'block';
        });

        // 共有ボタンの挙動：名前札(?t=)を渡すだけに修正
        copyBtn.onclick = () => {
            if (!selectedTab) return;
            const baseUrl = window.location.href.split('?')[0];
            const shareUrl = `${baseUrl}?t=${encodeURIComponent(selectedTab)}`;
            navigator.clipboard.writeText(shareUrl).then(() => alert('短縮URLをコピーしました！'));
        };

        const btnPc = document.getElementById('btn-pc');
        const btnMobile = document.getElementById('btn-mobile');
        const previewWrapper = document.getElementById('player-preview-wrapper');
        btnPc.onclick = () => { btnPc.classList.add('active'); btnMobile.classList.remove('active'); previewWrapper.className = 'player-table-container pc-view'; };
        btnMobile.onclick = () => { btnMobile.classList.add('active'); btnPc.classList.remove('active'); previewWrapper.className = 'player-table-container mobile-view'; };
    }

    async function initPlayerMode(encoded, tabName) {
        try {
            document.body.classList.add('is-player');
            generatorUI.style.display = 'none';
            playerUI.style.display = 'block';
            let quizData = [];
            let displayTitle = '';

            if (tabName) {
                document.getElementById('player-title').textContent = "読み込み中...";
                const grouped = await fetchDataFromGAS();
                quizData = grouped[tabName] || [];
                displayTitle = tabName;
            } else if (encoded) {
                const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))));
                displayTitle = payload.t; quizData = payload.x;
            }

            document.getElementById('player-title').textContent = displayTitle;
            document.getElementById('quiz-total-count').textContent = quizData.length;
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) playerUI.classList.add('mobile-view');
            renderQuizList('list-mount', quizData, displayTitle);
        } catch (e) { alert('URLが無効です。'); }
    }

    async function fetchDataFromGAS() {
        const res = await fetch(GAS_URL);
        const rawData = await res.json();
        const grouped = {};
        rawData.forEach(item => {
            const tabName = item['タブ'] || 'その他';
            if (!grouped[tabName]) grouped[tabName] = [];
            grouped[tabName].push({
                m: item['問題タイプ']||'', c: item['カテゴリ']||'', i: item['指示文']||'', q: item['問題']||'', a: item['正解']||'',
                d1: item['ダミー1']||'', d2: item['ダミー2']||'', d3: item['ダミー3']||'', e: item['解説']||'', t: item['日本語訳']||''
            });
        });
        return grouped;
    }

    function renderQuizList(mountId, data, title = '') {
        const mount = document.getElementById(mountId);
        let html = title ? `<div class="mobile-only-title">${title}</div>` : '';
        html += `<table class="player-table quiz-table"><thead><tr><th>No.</th><th>問題</th><th>選択肢</th><th>正解</th><th>解説</th></tr></thead><tbody>`;

        let lastKey = '';
        data.forEach((item, index) => {
            const currentKey = `${item.c}|${item.i}`;
            if (currentKey !== lastKey) {
                html += `<tr class="section-row"><td colspan="5"><div class="section-title"><span class="section-cat">${item.c}</span><span class="section-inst">${item.i}</span></div></td></tr>`;
                lastKey = currentKey;
            }

            let q = item.q, a = item.a, e = item.e || '';
            const strip = (s) => (s ? String(s).replace(/\[\[|\]\]/g, '') : '');
            if (q.includes('[')) {
                if (q.includes(':')) { a = q.replace(/\[\[?([^:\]]*?):[^\]]*?\]\]?/g, '$1'); q = q.replace(/\[\[?[^:\]]*?:([^\]]*?)\]\]?/g, '$1'); }
                q = strip(q); a = strip(a);
            }
            if (item.t) e = `【訳】\n${item.t}\n\n${e}`;
            e = strip(e);

            let choices = '';
            if (item.d1) {
                const arr = [a, item.d1, item.d2, item.d3].filter(x => x).sort(() => Math.random() - 0.5);
                choices = `<div class="choice-grid">${arr.map(c => `<div class="choice-item" onclick="speakText(event, this.textContent)">${c}</div>`).join('')}</div>`;
            }

            html += `
                <tr id="item-${mountId}-${index}" class="quiz-item-row" onclick="revealItem('${mountId}', ${index})">
                    <td class="td-no">${index + 1}</td>
                    <td class="td-q">
                        <div class="mobile-item-inner">
                            <div class="mobile-q-row"><span class="m-no">${index + 1}</span><span class="m-q" onclick="speakText(event, this.textContent)">${formatQ(q)}</span></div>
                            <div class="m-choices">${choices}</div>
                            <div class="m-reveal-area">
                                <div class="a-val" onclick="speakText(event, this.textContent)"><i class="ph ph-check-circle"></i> ${a}</div>
                                <div class="e-box">${e}</div>
                            </div>
                        </div>
                    </td>
                    <td class="td-c">${choices}</td><td class="td-a"><div class="a-val">${a}</div></td><td class="td-e"><div class="e-box">${e}</div></td>
                </tr>`;
            item._print = { q, a, e };
        });
        mount.innerHTML = html + `</tbody></table>`;
        
        if (mountId === 'list-mount') {
            document.getElementById('print-table-body').innerHTML = data.map((it, i) => `<tr><td>${i+1}</td><td>${it._print.q}</td><td><strong>${it._print.a}</strong></td><td>${it._print.e}</td></tr>`).join('');
        }
    }

    function formatQ(q) {
        if (!q) return '';
        const split = q.search(/[A-Za-z(]/);
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(q) && split > 0) {
            return `<div>${q.substring(0, split).trim()}</div><div style="font-size: 0.9em; color: var(--text-muted); margin-top: 4px;">${q.substring(split).trim()}</div>`;
        }
        return q;
    }

    window.revealItem = (m, i) => {
        const item = document.getElementById(`item-${m}-${i}`);
        const isR = item.classList.contains('revealed');
        document.querySelectorAll('.revealed').forEach(el => el.classList.remove('revealed'));
        if (!isR) item.classList.add('revealed');
    };

    let lastY = window.scrollY;
    window.addEventListener('scroll', () => { if (Math.abs(window.scrollY - lastY) > 20) { document.querySelectorAll('.revealed').forEach(el => el.classList.remove('revealed')); lastY = window.scrollY; } }, { passive: true });
});
