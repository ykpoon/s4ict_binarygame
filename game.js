/**
 * Stitch DSE ICT Space Data Arcade
 * 核心遊戲邏輯：
 * 1. 物理重力槓桿 (8-Bit 推進器與重力錨二補碼)
 * 2. 隕石單位防盾對撞機制 (實時容量轉換)
 * 3. 實體 Web Audio 合成音效
 */

const gameData = {
    score: parseInt(localStorage.getItem('stitch_arcade_score')) || 0,
    combo: 0,
    mode: 'lobby', // 'twos-complement', 'capacity-shield'
    
    // 遊戲一：二補碼重力錨
    tc: {
        bits: [0, 0, 0, 0, 0, 0, 0, 0],
        target: 0,
        timer: null,
        timeLeft: 25
    },
    
    // 遊戲二：容量防盾
    shield: {
        meteorValue: 0,
        meteorUnit: 'MB',
        correctAnswer: '',
        timer: null,
        timeLeft: 15
    }
};

// 網頁振盪器合成音效 (無需下載任何音訊檔)
const SoundEffects = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playLever() {
        // 扳動槓桿的清脆電子聲
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.start();
        osc.stop(t + 0.08);
    },
    playCorrect() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        // 太空能量充能琶音 (C5 -> E5 -> C6)
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.1);
        osc.frequency.setValueAtTime(1046.50, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 0.35);
        osc.start();
        osc.stop(t + 0.35);
    },
    playIncorrect() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        // 太空船警報低沉滑音 (F3 -> Db3)
        osc.frequency.setValueAtTime(174.61, t);
        osc.frequency.linearRampToValueAtTime(138.59, t + 0.3);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.start();
        osc.stop(t + 0.35);
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateGlobalUI();
});

// 切換遊戲模式
function startGame(mode) {
    gameData.mode = mode;
    document.getElementById('lobby-section').classList.add('hidden');
    
    if (mode === 'twos-complement') {
        document.getElementById('game-twos-section').classList.remove('hidden');
        initTwoComplementGame();
    } else if (mode === 'capacity-shield') {
        document.getElementById('game-shield-section').classList.remove('hidden');
        initCapacityShieldGame();
    }
}

// 返回大廳
function backToLobby() {
    // 清除定時器
    clearInterval(gameData.tc.timer);
    clearInterval(gameData.shield.timer);
    
    gameData.mode = 'lobby';
    document.getElementById('game-twos-section').classList.add('hidden');
    document.getElementById('game-shield-section').classList.add('hidden');
    document.getElementById('lobby-section').classList.remove('hidden');
}

// 渲染與更新全局計分
function updateGlobalUI() {
    document.getElementById('score').textContent = gameData.score;
    document.getElementById('combo').textContent = gameData.combo;
}

// ==================== 模式一：二補碼重力平衡器實作 ====================
function initTwoComplementGame() {
    // 隨機出題範圍 -128 到 +127 (不為0)
    let target = 0;
    while(target === 0) {
        target = Math.floor(Math.random() * 256) - 128;
    }
    gameData.tc.target = target;
    gameData.tc.bits = [0, 0, 0, 0, 0, 0, 0, 0];
    gameData.tc.timeLeft = 25;
    
    // 更新介面
    document.getElementById('tc-target-val').textContent = target > 0 ? `+${target}` : target;
    document.getElementById('tc-timer').textContent = gameData.tc.timeLeft;
    
    renderLevers();
    updateLeverCalculation();
    
    // 設定倒數
    clearInterval(gameData.tc.timer);
    gameData.tc.timer = setInterval(() => {
        gameData.tc.timeLeft--;
        document.getElementById('tc-timer').textContent = gameData.tc.timeLeft;
        
        // 倒數警告氛圍
        if (gameData.tc.timeLeft <= 5) {
            document.getElementById('stitch-face').textContent = "😱";
            document.getElementById('stitch-live-bubble').textContent = "「警告！推進引擎即將過熱爆炸！！快對齊數值！」";
        }
        
        if (gameData.tc.timeLeft <= 0) {
            clearInterval(gameData.tc.timer);
            triggerFeedback(false, `<b>重力反應爐熔毀！</b>太空船被拉扯進黑洞了！正確的位元組合是：<br><span class="font-mono text-teal-400">${getCorrectBitsForTarget(gameData.tc.target)}</span>。`);
        }
    }, 1000);
}

// 取得目標數值對應的正確 8位元二補碼二進制串
function getCorrectBitsForTarget(target) {
    let unsigned = target < 0 ? (256 + target) : target;
    return unsigned.toString(2).padStart(8, '0');
}

// 渲染極具操作感的物理推進槓桿
function renderLevers() {
    const panel = document.getElementById('lever-panel');
    panel.innerHTML = '';
    
    gameData.tc.bits.forEach((bit, idx) => {
        const isMSB = idx === 0;
        const col = document.createElement('div');
        col.className = "flex flex-col items-center justify-between h-full bg-slate-950/80 border border-slate-800 rounded-2xl p-2 relative";
        
        // 如果是 MSB，加上警示條紋線凸顯
        if (isMSB) {
            col.className += " border-rose-500/40 bg-rose-950/5";
        }
        
        col.innerHTML = `
            <!-- 位值與名稱標籤 -->
            <span class="text-[9px] font-bold text-slate-500">b${7 - idx}</span>
            <span class="text-[10px] font-black ${isMSB ? 'text-rose-400' : 'text-teal-400'}">${isMSB ? '重力錨' : '+' + Math.pow(2, 7 - idx)}</span>
            
            <!-- 槓桿軌道外觀 -->
            <div class="w-4 h-32 bg-slate-900 rounded-full border border-slate-800 relative flex items-center justify-center cursor-pointer" onclick="toggleLever(${idx})">
                <!-- 槓桿把手 (物理滑動感) -->
                <div class="absolute w-8 h-8 rounded-full shadow-md border-2 transition-all duration-200 flex items-center justify-center font-bold text-xs ${
                    bit === 1 
                        ? 'top-0 bg-gradient-to-b from-teal-400 to-teal-500 border-teal-600 text-slate-950' 
                        : 'bottom-0 bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600 text-slate-400'
                }" style="transform: translateY(${bit === 1 ? '0%' : '0%'});">
                    ${bit}
                </div>
            </div>
            
            <!-- 單個位元狀態 -->
            <span class="text-[9px] font-mono text-slate-500">${bit === 1 ? 'ON' : 'OFF'}</span>
        `;
        panel.appendChild(col);
    });
}

// 撥動槓桿
function toggleLever(idx) {
    SoundEffects.playLever();
    gameData.tc.bits[idx] = gameData.tc.bits[idx] === 0 ? 1 : 0;
    renderLevers();
    updateLeverCalculation();
}

// 更新槓桿推力實時運算
function updateLeverCalculation() {
    const bits = gameData.tc.bits;
    const isMSBOn = bits[0] === 1;
    
    // 計算微型推進器 (b6 - b0)
    let thrusterSum = 0;
    for (let i = 1; i < 8; i++) {
        if (bits[i] === 1) {
            thrusterSum += Math.pow(2, 7 - i);
        }
    }
    
    // 總推力（二補碼）
    const totalThrust = (isMSBOn ? -128 : 0) + thrusterSum;
    
    // 渲染 UI
    const currentValDisplay = document.getElementById('tc-current-val');
    currentValDisplay.textContent = totalThrust > 0 ? `+${totalThrust}` : totalThrust;
    
    // 修改重力錨狀態說明
    document.getElementById('msb-anchor-desc').innerHTML = isMSBOn 
        ? `<span class="text-rose-400 font-bold">已拋錨 (-128 kW)</span>` 
        : `未拋錨 (0 kW)`;
    document.getElementById('thruster-sum-desc').textContent = `${thrusterSum} kW`;
    
    // 副駕駛史迪仔的動態氣泡對話
    const bubble = document.getElementById('stitch-live-bubble');
    const face = document.getElementById('stitch-face');
    
    if (totalThrust === gameData.tc.target) {
        // 完美對齊！
        clearInterval(gameData.tc.timer);
        face.textContent = "😆";
        currentValDisplay.className = "text-3xl font-black text-emerald-400 tracking-tight mt-1 animate-pulse";
        bubble.textContent = "「對了！重力波與推進力完全抵消了！安全穩定！」";
        
        setTimeout(() => {
            triggerFeedback(true, `<b>完美平衡！</b>你精準操作了 8-bit 控制槓桿！<br>` +
                                  `目標推力為 <b>${gameData.tc.target}₁₀</b>，你設定的二進制為 <b>${bits.join('')}₂</b>。<br>` +
                                  `計算式：(${bits[0]} × -128) + (${bits[1]} × 64) + (${bits[2]} × 32) + (${bits[3]} × 16) + (${bits[4]} × 8) + (${bits[5]} × 4) + (${bits[6]} × 2) + (${bits[7]} × 1) = ${totalThrust} kW。`);
        }, 800);
    } else {
        currentValDisplay.className = "text-3xl font-black text-rose-500 tracking-tight mt-1";
        const diff = Math.abs(totalThrust - gameData.tc.target);
        if (diff > 50) {
            face.textContent = "😰";
            bubble.textContent = "「哇啊！重力差距太大，飛船正在劇烈搖晃！快調整推進器！」";
        } else if (diff > 10) {
            face.textContent = "😐";
            bubble.textContent = "「接近了！還差一點，再開多幾台推進器試試！」";
        } else {
            face.textContent = "😏";
            bubble.textContent = "「極度接近！最後精細調整一下幾台小推進器！」";
        }
    }
}


// ==================== 模式二：容量防盾對撞機實作 ====================
function initCapacityShieldGame() {
    gameData.shield.timeLeft = 15;
    document.getElementById('shield-timer').textContent = gameData.shield.timeLeft;
    
    // 隨機生成題目類型
    // 1. 2^10 進制轉換（隕石與正確答案為等值）
    const units = ['KB', 'MB', 'GB', 'TB'];
    const fromIdx = Math.floor(Math.random() * 3) + 1; // 1, 2, 3 -> MB, GB, TB
    const fromUnit = units[fromIdx];
    const toUnit = units[fromIdx - 1]; // 下降一級單位
    
    const value = Math.pow(2, Math.floor(Math.random() * 3) + 1); // 2, 4, 8
    
    // 設定來襲隕石
    const meteorStr = `${value} ${fromUnit}`;
    document.getElementById('meteor-val-display').textContent = meteorStr;
    
    // 正確答案
    const correctVal = value * 1024;
    const correctStr = `${correctVal.toLocaleString()} ${toUnit}`;
    gameData.shield.correctAnswer = correctStr;
    
    // 混淆防盾選項
    const wrong1 = `${value * 1000} ${toUnit}`; // 1000進制混淆
    const wrong2 = `${value * 1024 * 8} ${toUnit}`; // 乘以8混淆
    const wrong3 = `${value / 1024} ${toUnit}`; // 除法混淆
    
    const options = [correctStr, wrong1, wrong2, wrong3];
    shuffleArray(options);
    
    // 渲染防盾按鈕
    const container = document.getElementById('shield-options-container');
    container.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 hover:border-purple-400 p-4 rounded-2xl text-center text-sm font-bold tracking-wider transition active:scale-95 shadow-md shadow-purple-500/5 hover:shadow-purple-500/10";
        btn.innerHTML = `<span class="text-xs text-purple-500">防禦盾充能</span><br><span class="text-base font-mono text-purple-200 mt-1 block">${opt}</span>`;
        btn.addEventListener('click', () => checkShieldAnswer(opt, meteorStr, correctStr));
        container.appendChild(btn);
    });
    
    // 防盾定時器
    clearInterval(gameData.shield.timer);
    gameData.shield.timer = setInterval(() => {
        gameData.shield.timeLeft--;
        document.getElementById('shield-timer').textContent = gameData.shield.timeLeft;
        
        if (gameData.shield.timeLeft <= 0) {
            clearInterval(gameData.shield.timer);
            triggerFeedback(false, `<b>要塞防禦崩潰！</b>數據隕石撞擊成功！等值對撞防盾應該是：<br><span class="font-mono text-purple-400">${correctStr}</span>。`);
        }
    }, 1000);
}

// 防盾判定
function checkShieldAnswer(selected, meteor, correct) {
    clearInterval(gameData.shield.timer);
    const isCorrect = selected === correct;
    
    if (isCorrect) {
        triggerFeedback(true, `<b>對撞湮滅成功！</b><br>` +
                              `你精準發射了 <b>${selected}</b> 的對撞防禦波，將 <b>${meteor}</b> 的多媒體隕石成功湮滅！<br>` +
                              `解析：在 DSE ICT 中，除位元(bit)與位元組(Byte)間是 8進制 外，其餘大單位轉小單位（如 ${meteor.split(' ')[1]} 轉 ${selected.split(' ')[1]}）皆為 <b>1024 進制 (2¹⁰)</b>。`);
    } else {
        triggerFeedback(false, `<b>對撞失敗！防盾過載！</b><br>` +
                               `發射的 <b>${selected}</b> 防盾與 <b>${meteor}</b> 隕石頻率不相符，產生了強大震波！<br>` +
                               `正確的等值防盾應為：<b>${correct}</b>。<br>` +
                               `提示：請記住 1 GB = 1024 MB，千萬不要誤用十進制（如 1000）來計算喔！`);
    }
}


// ==================== 反饋視窗處理 ====================
function triggerFeedback(isCorrect, explanationText) {
    const modal = document.getElementById('feedback-modal');
    const headerBg = document.getElementById('modal-header-bg');
    const title = document.getElementById('modal-title');
    const icon = document.getElementById('modal-icon');
    const emoji = document.getElementById('stitch-emoji');
    const reactionText = document.getElementById('stitch-reaction-text');
    const explanation = document.getElementById('modal-explanation');
    const nextBtn = document.getElementById('btn-next-question');
    
    if (isCorrect) {
        SoundEffects.playCorrect();
        gameData.score += (10 + gameData.combo * 2);
        gameData.combo++;
        
        headerBg.className = "p-6 text-center text-white bg-gradient-to-r from-emerald-500 to-teal-500";
        title.textContent = "任務完成！MISSION CLEAR!";
        icon.innerHTML = `<i class="fa-solid fa-circle-check animate-bounce text-5xl"></i>`;
        
        // 史迪仔快樂表情
        emoji.textContent = "😆";
        reactionText.textContent = "「史迪仔開心地圍著你繞圈圈，太空船成功化險為夷！做得好！」";
        
        nextBtn.className = "w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-3 rounded-xl transition hover:opacity-90 active:scale-95";
    } else {
        SoundEffects.playIncorrect();
        gameData.combo = 0;
        
        headerBg.className = "p-6 text-center text-white bg-gradient-to-r from-rose-500 to-pink-500";
        title.textContent = "警報！要塞受損！";
        icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-5xl"></i>`;
        
        // 史迪仔扯耳朵哭泣表情 (對應學習冊 input_file_6 / input_file_15 等生氣生氣圖)
        emoji.textContent = "😢";
        reactionText.textContent = "「史迪仔氣餒得大叫，正狂扯著自己的長耳朵... 快閱讀解析幫他修好設備！」";
        
        nextBtn.className = "w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black py-3 rounded-xl transition hover:opacity-90 active:scale-95";
    }
    
    // 更新本地存儲
    localStorage.setItem('stitch_arcade_score', gameData.score);
    updateGlobalUI();
    
    explanation.innerHTML = explanationText;
    
    // 下一關
    nextBtn.onclick = () => {
        modal.classList.add('hidden');
        if (gameData.mode === 'twos-complement') {
            initTwoComplementGame();
        } else {
            initCapacityShieldGame();
        }
    };
    
    modal.classList.remove('hidden');
}

// 輔助：打亂陣列
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
