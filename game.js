/**
 * DSE ICT 數據大冒險 - 遊戲核心邏輯
 * 1. 8-Bit 互動沙盒（無符號、符號值、二補碼運算流程）
 * 2. 隨機題目生成與計分機制
 * 3. 內建 Web Audio API 音效生成
 */

// 遊戲狀態
const gameState = {
    score: parseInt(localStorage.getItem('ict_game_score')) || 0,
    combo: 0,
    currentMode: 'lobby', // 'twos-complement', 'capacity'
    currentBitArray: [0, 0, 0, 0, 0, 0, 0, 0], // 沙盒位元 (MSB -> LSB)
    currentQuestion: null
};

// 音效播放器 (使用瀏覽器振盪器 Synthesizer)
const SoundEffects = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playCorrect() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // 答對音效：清脆的小琶音 (C5 -> E5 -> G5)
        const t = this.ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
        
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        
        osc.start(t);
        osc.stop(t + 0.4);
    },
    playIncorrect() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // 答錯音效：低沉滑音 (A3 -> F3)
        const t = this.ctx.currentTime;
        osc.frequency.setValueAtTime(220.00, t); // A3
        osc.frequency.exponentialRampToValueAtTime(174.61, t + 0.3); // F3
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        
        osc.start(t);
        osc.stop(t + 0.35);
    }
};

// 網頁載入初始化
document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();
    renderSandboxBits();
    setupEventListeners();
    updateSandboxCalculations();
});

// 建立事件監聽
function setupEventListeners() {
    // 註冊沙盒按鈕事件
    document.getElementById('btn-sandbox-invert').addEventListener('click', () => {
        gameState.currentBitArray = gameState.currentBitArray.map(b => b === 0 ? 1 : 0);
        renderSandboxBits();
        updateSandboxCalculations();
    });

    document.getElementById('btn-sandbox-add1').addEventListener('click', () => {
        // 二進制 +1 邏輯
        let carry = 1;
        for (let i = 7; i >= 0; i--) {
            let sum = gameState.currentBitArray[i] + carry;
            if (sum === 2) {
                gameState.currentBitArray[i] = 0;
                carry = 1;
            } else {
                gameState.currentBitArray[i] = sum;
                carry = 0;
                break;
            }
        }
        renderSandboxBits();
        updateSandboxCalculations();
    });

    document.getElementById('btn-sandbox-reset').addEventListener('click', () => {
        gameState.currentBitArray = [0, 0, 0, 0, 0, 0, 0, 0];
        renderSandboxBits();
        updateSandboxCalculations();
    });

    // 註冊分數重置
    document.getElementById('btn-reset-score').addEventListener('click', () => {
        if(confirm("確定要重置你目前的得分紀錄嗎？")) {
            gameState.score = 0;
            gameState.combo = 0;
            localStorage.setItem('ict_game_score', 0);
            updateScoreUI();
        }
    });

    // 容量換算沙盒
    const convInput = document.getElementById('conv-input');
    const convFrom = document.getElementById('conv-from');
    const triggerCalculation = () => {
        const val = parseFloat(convInput.value) || 0;
        const unit = convFrom.value;
        updateUnitConverter(val, unit);
    };
    convInput.addEventListener('input', triggerCalculation);
    convFrom.addEventListener('change', triggerCalculation);
    triggerCalculation(); // 初始計算一次
}

// 切換遊戲模式
function switchMode(mode) {
    gameState.currentMode = mode;
    document.getElementById('lobby-section').classList.add('hidden');
    
    if (mode === 'twos-complement') {
        document.getElementById('twos-complement-section').classList.remove('hidden');
        generateTwoComplementQuestion();
    } else if (mode === 'capacity') {
        document.getElementById('capacity-section').classList.remove('hidden');
        generateCapacityQuestion();
    }
}

// 返回主選單
function showLobby() {
    gameState.currentMode = 'lobby';
    document.getElementById('twos-complement-section').classList.add('hidden');
    document.getElementById('capacity-section').classList.add('hidden');
    document.getElementById('lobby-section').classList.remove('hidden');
}

// 實時渲染沙盒 Bit 方塊
function renderSandboxBits() {
    const container = document.getElementById('bit-container');
    container.innerHTML = '';
    
    gameState.currentBitArray.forEach((bit, index) => {
        // 設定首位（MSB）為不同的醒目顏色，凸顯其為「符號位元 (Sign Bit)」
        const isSignBit = index === 0;
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all transform active:scale-95 ${
            bit === 1 
                ? (isSignBit ? 'bg-rose-500 border-rose-600 text-white' : 'bg-teal-500 border-teal-600 text-white')
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
        }`;
        
        btn.innerHTML = `
            <span class="text-xs text-slate-400 font-semibold mb-1">b<sub>${7 - index}</sub></span>
            <span class="text-2xl font-black">${bit}</span>
            <span class="text-[9px] mt-1 opacity-70">${isSignBit ? '符號位' : '位值:' + Math.pow(2, 7 - index)}</span>
        `;
        
        btn.addEventListener('click', () => {
            gameState.currentBitArray[index] = bit === 0 ? 1 : 0;
            renderSandboxBits();
            updateSandboxCalculations();
        });
        
        container.appendChild(btn);
    });
}

// 計算並更新沙盒顯示結果
function updateSandboxCalculations() {
    const bits = gameState.currentBitArray;
    const binaryStr = bits.join('');
    
    // 1. 無符號 (Unsigned)
    const valUnsigned = parseInt(binaryStr, 2);
    document.getElementById('val-unsigned').textContent = valUnsigned;
    
    // 2. 符號及值 (Sign & Magnitude)
    let valSignMag = 0;
    const magnitude = parseInt(binaryStr.substring(1), 2);
    if (bits[0] === 1) {
        valSignMag = -magnitude; // 首位是 1 表示負數
    } else {
        valSignMag = magnitude;
    }
    document.getElementById('val-signmag').textContent = bits.every(b => b === 0) ? "0" : valSignMag;
    
    // 3. 二補碼 (Two's Complement)
    let valTwos = valUnsigned;
    if (bits[0] === 1) { // 負數
        valTwos = valUnsigned - 256;
    }
    document.getElementById('val-twos').textContent = valTwos;
    
    // 4. 十六進制 (Hex)
    const valHex = valUnsigned.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('val-hex').textContent = `${valHex}₁₆`;
}

// 單位轉換沙盒換算
function updateUnitConverter(val, fromUnit) {
    // 統一把輸入轉為 Bits 基礎單位
    let bits = 0;
    switch (fromUnit) {
        case 'bit': bits = val; break;
        case 'B': bits = val * 8; break;
        case 'KB': bits = val * 8 * 1024; break;
        case 'MB': bits = val * 8 * 1024 * 1024; break;
        case 'GB': bits = val * 8 * 1024 * 1024 * 1024; break;
        case 'TB': bits = val * 8 * 1024 * 1024 * 1024 * 1024; break;
    }
    
    const formats = {
        bit: bits,
        B: bits / 8,
        KB: bits / 8 / 1024,
        MB: bits / 8 / 1024 / 1024,
        GB: bits / 8 / 1024 / 1024 / 1024,
        TB: bits / 8 / 1024 / 1024 / 1024 / 1024
    };
    
    // 寫入 UI 顯示
    document.getElementById('res-bit').textContent = formatNumber(formats.bit);
    document.getElementById('res-B').textContent = formatNumber(formats.B);
    document.getElementById('res-KB').textContent = formatNumber(formats.KB);
    document.getElementById('res-MB').textContent = formatNumber(formats.MB);
    document.getElementById('res-GB').textContent = formatNumber(formats.GB);
    document.getElementById('res-TB').textContent = formatNumber(formats.TB);
}

// 格式化輸出大數字，避免過長
function formatNumber(num) {
    if (num === 0) return '0';
    if (num < 0.001) return num.toExponential(4);
    if (num % 1 !== 0) return num.toLocaleString('zh-HK', { maximumFractionDigits: 4 });
    return num.toLocaleString('zh-HK');
}

// 更新計分板 UI
function updateScoreUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('combo').textContent = gameState.combo;
}

// ==================== 闖關模組：二補碼出題器 ====================
function generateTwoComplementQuestion() {
    const qTypes = ['bin_to_dec', 'dec_to_bin', 'overflow_check', 'addition_subtraction'];
    const selectedType = qTypes[Math.floor(Math.random() * qTypes.length)];
    
    let questionText = "";
    let correctAnswer = "";
    let options = [];
    let explanation = "";

    if (selectedType === 'bin_to_dec') {
        // 二進制轉十進制 (8-bit)
        // 50% 機率生成負數
        const bits = Array.from({length: 8}, () => Math.random() > 0.5 ? 1 : 0);
        if (bits.every(b => b === 0)) bits[0] = 1; // 避免全 0
        const binaryStr = bits.join('');
        const valUnsigned = parseInt(binaryStr, 2);
        const decVal = bits[0] === 1 ? valUnsigned - 256 : valUnsigned;
        
        questionText = `把下列 8位元 二補碼（Two's Complement）二進制數字轉為十進制數字：<br><span class="text-2xl font-bold tracking-widest text-teal-400 font-mono">${binaryStr}₂</span>`;
        correctAnswer = decVal.toString();
        
        // 生成干擾項
        const wrong1 = valUnsigned.toString(); // 當成無符號
        const wrong2 = (bits[0] === 1 ? -(valUnsigned & 127) : decVal).toString(); // 當成符號值
        const wrong3 = (decVal + (Math.random() > 0.5 ? 1 : -1) * 8).toString();
        
        options = [correctAnswer, wrong1, wrong2, wrong3];
        explanation = `8位元二補碼中，最左邊的第一個位元（MSB）為符號位（位值為 -128）。<br>` +
                      `算式：(${bits[0]} × -128) + (${bits[1]} × 64) + (${bits[2]} × 32) + (${bits[3]} × 16) + (${bits[4]} × 8) + (${bits[5]} × 4) + (${bits[6]} × 2) + (${bits[7]} × 1) = ${decVal}₁₀。<br>` +
                      `捷徑法：因為首位是 1 (負數)，可先取反 (${bits.map(b => b === 0 ? 1 : 0).join('')}) 得到 ${255 - valUnsigned}，再加 1 得到 ${256 - valUnsigned}。故數值為 -${256 - valUnsigned} = ${decVal}。`;

    } else if (selectedType === 'dec_to_bin') {
        // 十進制轉二進制 (8-bit 二補碼)
        const decVal = Math.floor(Math.random() * 80) - 90; // 生成 -90 到 -10 的負數
        const absVal = Math.abs(decVal);
        
        // 算出二補碼
        const binRep = ((1 << 8) + decVal).toString(2).padStart(8, '0');
        
        questionText = `請將十進制數字 <span class="text-xl font-bold text-teal-300">${decVal}₁₀</span> 轉換為 8位元 二補碼（Two's Complement）二進制表示法：`;
        correctAnswer = binRep;
        
        // 生成干擾項
        const wrong1 = "1" + absVal.toString(2).padStart(7, '0'); // 符號值表示法
        const wrong2 = (128 + decVal).toString(2).padStart(8, '0');
        const wrong3 = ((1 << 8) + decVal - 1).toString(2).padStart(8, '0'); // 漏了最後加一
        
        options = [correctAnswer, wrong1, wrong2, wrong3];
        explanation = `將負十進制數 ${decVal} 轉為 8位元二補碼步驟：<br>` +
                      `1. 先寫出正數的二進制（${absVal}₁₀ = ${absVal.toString(2).padStart(8, '0')}₂）<br>` +
                      `2. 將所有位元「取反」（0變1, 1變0），得到一補碼（${absVal.toString(2).padStart(8, '0').split('').map(b => b === '0' ? '1' : '0').join('')}₂）<br>` +
                      `3. 最後「加 1」即得二補碼：${binRep}₂。`;

    } else if (selectedType === 'overflow_check') {
        // 溢出誤差與位元數判斷 (對應學習冊 練習5 題目)
        const scenario = Math.random() > 0.5 ? 'overflow_4bit' : 'min_bits_25';
        
        if (scenario === 'overflow_4bit') {
            questionText = `我們能運用 <span class="text-teal-300 font-bold">4位元</span> 的二補碼來表示十進制數 <span class="text-rose-400 font-bold">-13₁₀</span> 嗎？為甚麼？`;
            correctAnswer = "不能，因為 4位元二補碼的範圍是 -8 至 +7，-13 超出範圍會產生溢出誤差。";
            options = [
                correctAnswer,
                "能，因為 4位元二補碼最大可表示至 -16，所以足夠容納。",
                "能，只需要將首位設為 1，其餘三位設為 13 的二進制即可。",
                "不能，二補碼不允許表示任何負奇數，只能表示偶數。"
            ];
            explanation = `在 n 位元二補碼中，可表示的整數範圍是 -2^(n-1) 至 +(2^(n-1) - 1)。<br>` +
                          `對於 4位元：範圍為 -2³ 至 +(2³ - 1) = -8 至 +7。<br>` +
                          `由於 -13 小於最小容許值 -8，因此無法表示，強行計算將導致「溢出誤差 (Overflow Error)」。`;
        } else {
            questionText = `若要以「二補碼」表示十進制整數 <span class="text-teal-300 font-bold">-25₁₀</span>，最少需要多少個位元（Bits）？`;
            correctAnswer = "6位元";
            options = [correctAnswer, "5位元", "4位元", "8位元"];
            explanation = `讓我們估算不同位元數能表示的最小二補碼值：<br>` +
                          `- 4位元範圍：-8 至 +7 (不夠表示 -25)<br>` +
                          `- 5位元範圍：-16 至 +15 (仍不夠表示 -25)<br>` +
                          `- 6位元範圍：-32 至 +31 (可以安全表示 -25！)<br>` +
                          `因此，最少需要 6 個位元。`;
        }

    } else if (selectedType === 'addition_subtraction') {
        // 二進制加減法 (對應練習3 運算)
        const a = Math.floor(Math.random() * 10) + 5; // 5-15
        const b = Math.floor(Math.random() * 4) + 1;  // 1-4
        const isAdd = Math.random() > 0.5;
        
        const binA = a.toString(2);
        const binB = b.toString(2);
        
        if (isAdd) {
            questionText = `請計算下列二進制加法運算：<br><span class="text-2xl font-bold tracking-widest text-teal-400 font-mono">${binA}₂ + ${binB}₂ = ?</span>`;
            correctAnswer = (a + b).toString(2) + "₂";
            options = [
                correctAnswer,
                (a + b + 2).toString(2) + "₂",
                (a - b).toString(2) + "₂",
                (a + b).toString(2) + "₁₀" // 混淆進制
            ];
            explanation = `十進制算式：${a} + ${b} = ${a + b}。<br>` +
                          `二進制直式計算：留意 1₂ + 1₂ = 10₂ (逢二進一)。<br>` +
                          `${binA}₂ + ${binB}₂ = ${(a + b).toString(2)}₂。`;
        } else {
            questionText = `請計算下列二進制減法運算：<br><span class="text-2xl font-bold tracking-widest text-teal-400 font-mono">${binA}₂ - ${binB}₂ = ?</span>`;
            correctAnswer = (a - b).toString(2) + "₂";
            options = [
                correctAnswer,
                (a - b - 1).toString(2) + "₂",
                (a + b).toString(2) + "₂",
                "1001₂"
            ];
            explanation = `十進制算式：${a} - ${b} = ${a - b}。<br>` +
                          `二進制直式計算：不夠減時需向高位借 1 (當作 2₂ 運算)。<br>` +
                          `${binA}₂ - ${binB}₂ = ${(a - b).toString(2)}₂。`;
        }
    }

    gameState.currentQuestion = {
        correctAnswer,
        explanation,
        mode: 'twos-complement'
    };

    // 渲染題目
    document.getElementById('binary-question-text').innerHTML = questionText;
    
    // 渲染打亂後的選項
    shuffleArray(options);
    const container = document.getElementById('binary-options-container');
    container.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 p-4 rounded-xl text-left text-sm transition font-medium hover:border-teal-500 active:scale-95";
        btn.innerHTML = opt;
        btn.addEventListener('click', () => checkAnswer(opt));
        container.appendChild(btn);
    });
}

// ==================== 闖關模組：容量轉換出題器 ====================
function generateCapacityQuestion() {
    const qTypes = ['basic_unit', 'video_formula'];
    const selectedType = qTypes[Math.floor(Math.random() * qTypes.length)];
    
    let questionText = "";
    let correctAnswer = "";
    let options = [];
    let explanation = "";

    if (selectedType === 'basic_unit') {
        // 基礎容量單位換算 (e.g., GB -> MB)
        const units = ['KB', 'MB', 'GB', 'TB'];
        const fromIdx = Math.floor(Math.random() * 3) + 1; // MB, GB, TB
        const fromUnit = units[fromIdx];
        const toUnit = units[fromIdx - 1]; // 下降一階
        
        const val = Math.pow(2, Math.floor(Math.random() * 3) + 1); // 2, 4, 8
        
        questionText = `數據容量單位換算：請問 <span class="text-indigo-300 font-bold">${val} ${fromUnit}</span> 等於多少 <span class="text-indigo-300 font-bold">${toUnit}</span>？`;
        correctAnswer = `${val * 1024} ${toUnit}`;
        
        options = [
            correctAnswer,
            `${val * 1000} ${toUnit}`, // 1000 進制干擾項
            `${val * 1024 * 8} ${toUnit}`, // 乘以 8 干擾
            `${val / 1024} ${toUnit}` // 除以 1024 干擾
        ];
        
        explanation = `DSE ICT 中，除了 Bit與Byte 之間是 8進制 外，其餘相鄰的高級儲存單位（KB, MB, GB, TB）換算率皆為 1024 (2¹⁰)。<br>` +
                      `所以，從大單位 (${fromUnit}) 轉為相鄰小單位 (${toUnit}) 需「乘以 1024」：<br>` +
                      `${val} × 1024 = ${val * 1024} ${toUnit}。`;

    } else if (selectedType === 'video_formula') {
        // 影片大小估算公式題 (完全對應學習冊 練習8 晉康影片題)
        const resolutions = [
            { name: "1920 x 1080 (1080p)", w: 1920, h: 1080 },
            { name: "1280 x 720 (720p)", w: 1280, h: 720 },
            { name: "800 x 600 (SVGA)", w: 800, h: 600 }
        ];
        const res = resolutions[Math.floor(Math.random() * resolutions.length)];
        const colorDepth = Math.random() > 0.5 ? 24 : 8; // 24-bit True Color or 8-bit
        const fps = Math.random() > 0.5 ? 60 : 30; // 60fps or 30fps
        const durationSec = Math.random() > 0.5 ? 600 : 300; // 10 mins (600s) or 5 mins (300s)
        const audioMb = Math.random() > 0.5 ? 100 : 50; // 100MB or 50MB
        
        // 計算影片部分容量 (GB)
        const videoBits = res.w * res.h * colorDepth * fps * durationSec;
        const videoGb = videoBits / 8 / 1024 / 1024 / 1024;
        const audioGb = audioMb / 1024;
        const totalGb = videoGb + audioGb;
        
        // 四捨五入
        const roundedTotal = Math.round(totalGb * 100) / 100;
        
        questionText = `<b>多媒體大小估算挑戰：</b><br>同學拍攝了一部具有以下屬性的影片：<br>` +
                      `· 色深：<span class="text-indigo-300">${colorDepth} 位元</span><br>` +
                      `· 解像度：<span class="text-indigo-300">${res.name}</span><br>` +
                      `· 幀速率：<span class="text-indigo-300">${fps} 幀/秒</span><br>` +
                      `· 長度：<span class="text-indigo-300">${durationSec / 60} 分鐘 (${durationSec}秒)</span><br>` +
                      `· 已知音頻大小為：<span class="text-indigo-300">${audioMb} MB</span><br>` +
                      `<b>請估算整部影片（包含音頻）的大小（以 GB 為單位，四捨五入至兩位小數）：</b>`;
                      
        correctAnswer = `${roundedTotal.toFixed(2)} GB`;
        
        // 混淆項
        const wrong1 = `${(Math.round(videoGb * 100) / 100).toFixed(2)} GB`; // 忘記加音頻
        const wrong2 = `${(Math.round((videoBits / 8 / 1000 / 1000 / 1000 + audioMb / 1000) * 100) / 100).toFixed(2)} GB`; // 使用 1000 計算
        const wrong3 = `${(Math.round((videoGb * 8) * 100) / 100).toFixed(2)} GB`; // 忘記除以 8
        
        options = [correctAnswer, wrong1, wrong2, wrong3];
        explanation = `<b>影片大小計算步驟：</b><br>` +
                      `1. <b>影像資料 (Bits)</b> = 色深 × 解像度 × 幀速率 × 秒數<br>` +
                      `   = ${colorDepth} × (${res.w} × ${res.h}) × ${fps} × ${durationSec} = ${videoBits.toLocaleString()} bits<br>` +
                      `2. <b>換算影像為 GB</b> = ${videoBits.toLocaleString()} ÷ 8 (換為 Byte) ÷ 1024 (KB) ÷ 1024 (MB) ÷ 1024 (GB) ≈ ${videoGb.toFixed(4)} GB<br>` +
                      `3. <b>音頻換算為 GB</b> = ${audioMb} MB ÷ 1024 ≈ ${audioGb.toFixed(4)} GB<br>` +
                      `4. <b>總大小</b> = ${videoGb.toFixed(4)} + ${audioGb.toFixed(4)} = ${totalGb.toFixed(4)} GB ≈ <b>${roundedTotal.toFixed(2)} GB</b>。`;
    }

    gameState.currentQuestion = {
        correctAnswer,
        explanation,
        mode: 'capacity'
    };

    document.getElementById('capacity-question-text').innerHTML = questionText;
    
    shuffleArray(options);
    const container = document.getElementById('capacity-options-container');
    container.innerHTML = '';
    
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 p-4 rounded-xl text-left text-sm transition font-medium hover:border-indigo-500 active:scale-95";
        btn.innerHTML = opt;
        btn.addEventListener('click', () => checkAnswer(opt));
        container.appendChild(btn);
    });
}

// ==================== 判斷答案與反饋 ====================
function checkAnswer(selectedOption) {
    const q = gameState.currentQuestion;
    const isCorrect = selectedOption === q.correctAnswer;
    
    // 獲取 Modal 相關 DOM
    const modal = document.getElementById('feedback-modal');
    const headerBg = document.getElementById('modal-header-bg');
    const title = document.getElementById('modal-title');
    const icon = document.getElementById('modal-icon');
    const emoji = document.getElementById('stitch-emoji');
    const reactionText = document.getElementById('stitch-reaction-text');
    const explanationText = document.getElementById('modal-explanation');
    const nextBtn = document.getElementById('btn-next-question');

    if (isCorrect) {
        // 播放答對音效
        SoundEffects.playCorrect();
        gameState.score += (10 + gameState.combo * 2); // 連擊加成
        gameState.combo += 1;
        
        // 設置 Modal 為答對風格
        headerBg.className = "p-6 text-center text-white bg-gradient-to-r from-emerald-500 to-teal-500";
        title.textContent = "答對了！恭喜！";
        icon.innerHTML = `<i class="fa-solid fa-circle-check animate-bounce"></i>`;
        
        // 史迪仔的快樂回應（對應 A1Ch3 學習冊 Stitch 笑臉圖 😆）
        emoji.textContent = "😆";
        reactionText.textContent = "「史迪仔高興地手舞足蹈，開心地笑了！你太聰明了！」";
        
        nextBtn.className = "w-full py-3 px-4 rounded-xl text-white font-bold transition shadow-lg bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20";
    } else {
        // 播放答錯音效
        SoundEffects.playIncorrect();
        gameState.combo = 0; // 重置連擊
        
        // 設置 Modal 為答錯風格
        headerBg.className = "p-6 text-center text-white bg-gradient-to-r from-rose-500 to-pink-500";
        title.textContent = "答錯了，再接再厲！";
        icon.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
        
        // 史迪仔的生氣回應（對應 A1Ch3 學習冊 Stitch 扯耳朵生氣圖 😢）
        emoji.textContent = "😢";
        reactionText.textContent = "「史迪仔正在氣餒地拉扯自己的耳朵，一邊哇哇大叫... 請認真閱讀解析並再試一次！」";
        
        nextBtn.className = "w-full py-3 px-4 rounded-xl text-white font-bold transition shadow-lg bg-rose-500 hover:bg-rose-600 shadow-rose-500/20";
    }

    // 儲存分數到 localStorage
    localStorage.setItem('ict_game_score', gameState.score);
    updateScoreUI();

    // 填充解析文字
    explanationText.innerHTML = q.explanation;
    
    // 綁定下一題按鈕
    nextBtn.onclick = () => {
        modal.classList.add('hidden');
        if (q.mode === 'twos-complement') {
            generateTwoComplementQuestion();
        } else {
            generateCapacityQuestion();
        }
    };

    // 顯示 Modal
    modal.classList.remove('hidden');
}

// 輔助函式：打亂陣列
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
