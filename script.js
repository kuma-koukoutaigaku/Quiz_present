// 英語音声の読み上げ (グローバルスコープ)
window.speakText = function (e, text) {
    if (e) e.stopPropagation();
    if (!text) return;

    // 不要な記号やアイコンを除去
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
    const dataParam = urlParams.get('d');
    const tabParam = urlParams.get('t');

    // デバッグ用: 起動ログ
    console.log("App Started. Params: t=" + tabParam + ", d=" + (dataParam ? "exists" : "none"));

    if (dataParam || tabParam) {
        initPlayerMode(dataParam, tabParam);
    } else {
        initGeneratorMode();
    }

    // ==========================================
    // Generator Mode (作成画面)
    // ==========================================
    async function fetchDataFromGAS() {
        console.log("Fetching from GAS: " + GAS_URL);
        try {
            const res = await fetch(GAS_URL);
            if (!res.ok) throw new Error('HTTPエラー ステータス: ' + res.status);
            const rawData = await res.json();
            console.log("Data received. Rows: " + rawData.length);

            // スプレッドシートの各行（データ）を、指定された「タブ」列の値でグループ化する
            const grouped = {};
            rawData.forEach(item => {
                // カラム名の揺れに対応（'タブ' または 'tab'）
                let tabName = item['タブ'] || item['tab'] || 'その他';
                tabName = String(tabName).trim(); // 前後の空白を削除

                if (!grouped[tabName]) grouped[tabName] = [];

                grouped[tabName].push({
                    m: item['問題タイプ'] || item['mode'] || '',
                    c: item['カテゴリ'] || item['category'] || '',
                    i: item['指示文'] || item['instruction'] || '',
                    q: item['問題'] || item['question'] || '',
                    a: item['正解'] || item['answer'] || '',
                    d1: item['ダミー1'] || item['dummy1'] || '',
                    d2: item['ダミー2'] || item['dummy2'] || '',
                    d3: item['ダミー3'] || item['dummy3'] || '',
                    e: item['解説'] || item['explanation'] || '',
                    t: item['日本語訳'] || item['translation'] || ''
                });
            });
            console.log("Grouped tabs found: " + Object.keys(grouped).join(", "));
            return grouped;
        } catch (err) {
            console.error("Fetch Error Details:", err);
            throw err;
        }
    }

    function initGeneratorMode() {
        console.log("Entering Generator Mode");
        syncStatus.innerHTML = '<i class="ph ph-cloud-arrow-down"></i><p>スプレッドシートと同期中...</p>';
        syncStatus.style.display = 'flex';

        fetchDataFromGAS().then(grouped => {
            currentGroupedData = grouped;
            const tabs = Object.keys(grouped);
            if (tabs.length === 0) throw new Error('スプレッドシートにデータが見つかりませんでした。');

            tabButtons.innerHTML = tabs.map(tab => `<button class="tab-btn">${tab}</button>`).join('');
            tabButtons.querySelectorAll('.tab-btn').forEach((btn, i) => {
                btn.onclick = () => selectTab(tabs[i], btn);
            });

            syncStatus.style.display = 'none';
            tabSelector.style.display = 'block';
            console.log("Sync Complete. Tabs ready.");
        }).catch(err => {
            console.error("Generator Init Error:", err);
            syncStatus.innerHTML = `<div style="color:red; padding: 20px;">
                <p style="font-weight:bold;">同期に失敗しました</p>
                <p style="font-size:0.9em; margin: 10px 0;">${err.message}</p>
                <button onclick="location.reload()" style="padding:5px 10px; cursor:pointer;">再試行</button>
            </div>`;
        });

        function selectTab(tab, btn) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTab = tab;
            currentTabSpan.textContent = tab;

            // プレビュー表示もプレイヤーと同じロジックを使用
            renderQuizList('preview-mount', currentGroupedData[tab], tab);

            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

        // デバイス切り替え
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

            // ローカルファイルからの共有は警告
            if (window.location.protocol === 'file:') {
                alert('警告: 現在ローカルファイル（テスト中）として開いています。GitHub上でこのボタンを押さないと、生成されたリンクは他のスマホでは開きません。');
            }

            const baseUrl = window.location.href.split('?')[0];
            const shareUrl = `${baseUrl}?t=${encodeURIComponent(selectedTab)}`;

            // URLの長さチェック（一般的におおよそ 2000〜8000文字を超えると危険）
            if (shareUrl.length > 8000) {
                console.warn('URL length is very long:', shareUrl.length);
                alert('警告: 問題数が多すぎるため、一部のスマホアプリではリンクが開けない可能性があります。');
            }

            navigator.clipboard.writeText(shareUrl).then(() => alert('短縮URLをコピーしました！'));
        };
    }

    // ==========================================
    // Player Mode (視聴者画面 - 共通表示ロジック)
    // ==========================================
    async function initPlayerMode(encodedBase64, tabName) {
        console.log("Entering Player Mode for: " + (tabName || "Encoded Data"));
        try {
            document.body.classList.add('is-player');
            generatorUI.style.display = 'none';
            playerUI.style.display = 'block';
            let quizData = [];
            let displayTitle = '';

            if (tabName) {
                document.getElementById('player-title').textContent = "読込中...";
                const grouped = await fetchDataFromGAS();

                // タブ名の完全一致で探す
                quizData = grouped[tabName];

                // 見つからない場合、念のため前後空白を消したもの同士で再検索
                if (!quizData) {
                    const cleanTab = tabName.trim();
                    const targetKey = Object.keys(grouped).find(k => k.trim() === cleanTab);
                    if (targetKey) quizData = grouped[targetKey];
                }

                if (!quizData || quizData.length === 0) {
                    throw new Error(`タブ「${tabName}」が見つかりません。GAS側にデータがあるか確認してください。`);
                }
                displayTitle = tabName;
            } else if (encodedBase64) {
                const base64 = decodeURIComponent(encodedBase64);
                const json = decodeURIComponent(escape(atob(base64)));
                const payload = JSON.parse(json);
                displayTitle = payload.t || 'Quiz List';
                quizData = payload.x || [];
            }

            if (quizData.length === 0) throw new Error('クイズが見つかりません');

            document.getElementById('player-title').textContent = displayTitle;

            // 共有リンク時、スマホなら自動でモバイルビューに
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                playerUI.classList.add('mobile-view');
            }

            renderQuizList('list-mount', quizData, displayTitle);
        } catch (e) {
            console.error("Player mode init error:", e);
            alert('エラー: ' + e.message);
        }
    }

    function renderQuizList(mountId, data, title = '') {
        const mount = document.getElementById(mountId);
        if (!mount) return;
        let html = '';
        html += `<table class="player-table quiz-table"><thead><tr><th>No.</th><th>問題</th><th>選択肢</th><th>正解</th><th>解説</th></tr></thead><tbody>`;

        let lastSectionKey = '';
        data.forEach((item, index) => {
            const currentSectionKey = `${item.c}|${item.i}`;
            if (currentSectionKey !== lastSectionKey) {
                html += `
                    <tr class="section-row">
                        <td colspan="5">
                            <div class="section-title">
                                <span class="section-cat">${esc(item.c || 'Category')}</span>
                                <span class="section-inst">${esc(item.i || '指示に従って答えよ')}</span>
                            </div>
                        </td>
                    </tr>
                `;
                lastSectionKey = currentSectionKey;
            }

            let displayQ = item.q;
            let displayA = item.a;

            // --- 全てのブラケット除去 (間違い探し・通常モード共通) ---
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

            displayQ = formatQ(displayQ);
            let displayChoices = '';
            let explanation = item.e || '';
            if (item.t) explanation = `【日本語訳】\n${item.t}\n\n${explanation}`;
            explanation = stripBrackets(explanation);

            // --- モード特定処理 ---
            if (item.m === 'sort') {
                const baseStr = String(item.a);
                const blocks = baseStr.includes('/') ? baseStr.split('/') : baseStr.split(/\s+/);
                const shuffled = shuffle(blocks.filter(s => s.trim() !== ''));
                displayChoices = `<div class="anagram-box-container">${shuffled.map(unit => `<span>${esc(unit.trim())}</span>`).join('')}</div>`;
            }
            else if (item.m === 'anagram') {
                let sourceStr = String(item.a);
                if (String(item.q).includes('/')) sourceStr = String(item.q);
                const units = sourceStr.includes('/') ? sourceStr.split('/') : sourceStr.split('');
                const shuffled = shuffle(units.filter(s => s.trim() !== ''));
                displayQ = `<div class="anagram-box-container">${shuffled.map(u => `<span>${esc(u)}</span>`).join('')}</div>`;
                displayChoices = '';
            }

            // --- 4択表示の判定 ---
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
                            ${displayChoices ? `<div class="m-choices">${displayChoices}</div>` : ''}
                            <div class="m-reveal-area">
                                <div class="a-val" onclick="speakText(event, this.textContent)"><i class="ph ph-check-circle"></i> ${esc(displayA)}</div>
                                <div class="e-box">${esc(explanation.trim())}</div>
                            </div>
                        </div>
                    </td>
                    <td class="td-c">${displayChoices}</td>
                    <td class="td-a"><div class="a-val">${esc(displayA)}</div></td>
                    <td class="td-e"><div class="e-box">${esc(explanation.trim())}</div></td>
                </tr>
            `;
            item._print = printItemData;
        });

        html += `</tbody></table>`;
        listMount.innerHTML = html;

        if (mountId === 'list-mount') {
            const printBody = document.getElementById('print-table-body');
            document.getElementById('print-title').textContent = title;
            printBody.innerHTML = data.map((item, i) => {
                const d = item._print;
                return `<tr><td>${i + 1}</td><td>${d.q}</td><td><strong>${esc(d.a)}</strong></td><td>${esc(d.e)}</td></tr>`;
            }).join('');
        }
    }

    window.revealItem = (mountId, idx) => {
        const item = document.getElementById(`item-${mountId}-${idx}`);
        const isRevealed = item.classList.contains('revealed');

        // 他の開いているアイテムを閉じる（オプション: 一度に一つだけ開く挙動）
        document.querySelectorAll('.revealed').forEach(el => {
            if (el !== item) el.classList.remove('revealed');
        });

        if (isRevealed) {
            item.classList.remove('revealed');
        } else {
            item.classList.add('revealed');
        }
    };

    // スクロール時に解答を閉じる（モバイル体験向上）
    const closeRevealed = () => {
        document.querySelectorAll('.revealed').forEach(el => el.classList.remove('revealed'));
    };

    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (Math.abs(window.scrollY - lastScrollY) > 20) {
            closeRevealed();
            lastScrollY = window.scrollY;
        }
    }, { passive: true });

    // プレビューコンテナ内のスクロールにも対応
    const previewContainer = document.getElementById('player-preview-wrapper');
    if (previewContainer) {
        let lastContScrollY = previewContainer.scrollTop;
        previewContainer.addEventListener('scroll', () => {
            if (Math.abs(previewContainer.scrollTop - lastContScrollY) > 20) {
                closeRevealed();
                lastContScrollY = previewContainer.scrollTop;
            }
        }, { passive: true });
    }

    function formatQ(q) {
        if (!q) return '';
        const hasJp = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(q);
        const splitIndex = q.search(/[A-Za-z(]/);

        if (hasJp && splitIndex > 0) {
            const line1 = q.substring(0, splitIndex).trim();
            const line2 = q.substring(splitIndex).trim();
            return `<div>${esc(line1)}</div><div style="font-size: 0.9em; color: var(--text-muted); margin-top: 4px;">${esc(line2)}</div>`;
        }
        return esc(q);
    }

    function shuffle(arr) {
        const a = arr.filter(s => s && String(s).trim() !== '');
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : ''; }
});
