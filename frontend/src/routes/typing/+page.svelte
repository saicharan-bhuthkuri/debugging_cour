<script lang="ts">
    import { onMount } from "svelte";

    onMount(() => {
        // --- CONFIGURATION ---
        const TIME_LIMIT = 300; // 5 minutes in seconds

        // Complex paragraphs for "Difficult" mode
        const PARAGRAPHS = [
            "The asynchronous nature of JavaScript allows for non-blocking I/O operations, which is essential for high-performance web applications. However, handling callbacks can lead to 'callback hell', a situation where callbacks are nested within other callbacks several levels deep. Promises and async/await syntax were introduced to mitigate this issue, providing a cleaner, more readable way to handle asynchronous code logic.",
            "In object-oriented programming, polymorphism allows objects to be treated as instances of their parent class rather than their actual class. The most common use of polymorphism in OOP occurs when a parent class reference is used to refer to a child class object. This concept is fundamental to building flexible and scalable software architectures, enabling developers to write code that is easier to extend and maintain.",
            "Cryptographic hash functions are mathematical algorithms that map data of arbitrary size to a bit string of a fixed size. It is a one-way function, that is, a function which is practically infeasible to invert. The only way to recreate the input data from an ideal cryptographic hash function's output is to attempt a brute-force search of possible inputs to see if they produce a match.",
            "Quantum computing harnesses the phenomena of quantum mechanics to deliver a huge leap forward in computation to solve certain problems. Quantum computers operate on qubits, which can exist in a state of superposition, representing both 0 and 1 simultaneously. This differs fundamentally from classical bits that can only be either 0 or 1 at any given time.",
            "Normalization is the process of organizing data in a database. This includes creating tables and establishing relationships between those tables according to rules designed both to protect the data and to make the database more flexible by eliminating redundancy and inconsistent dependency. First Normal Form (1NF) sets the very basic rules for an organized database.",
            "Recursive functions are functions that call themselves. They are useful for solving problems that can be defined in terms of smaller, similar subproblems. However, care must be taken to ensure that the recursion terminates; otherwise, it will lead to a stack overflow error, crashing the program. The base case is the condition under which the recursion stops.",
            "The Document Object Model (DOM) is a cross-platform and language-independent interface that treats an XML or HTML document as a tree structure wherein each node is an object representing a part of the document. The DOM represents a document with a logical tree. Each branch of the tree ends in a node, and each node contains objects. DOM methods allow programmatic access to the tree.",
        ];

        // --- STATE ---
        let timeLeft = TIME_LIMIT;
        let timer = null;
        let isRunning = false;
        let charIndex = 0;
        let mistakes = 0;
        let isFocused = false;
        let currentText = "";

        // --- ELEMENTS ---
        const textDisplay = document.getElementById("textDisplay");
        const inputField = document.getElementById("inputField");
        const timerElement = document.getElementById("timer");
        const wpmElement = document.getElementById("wpm");
        const accElement = document.getElementById("accuracy");
        const focusOverlay = document.getElementById("focusOverlay");
        const resultModal = document.getElementById("resultModal");

        // --- URL PARAMS ---
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get("name") || "Guest";
        const branch = urlParams.get("branch") || "UNK";
        const year = urlParams.get("year") || "?";

        document.getElementById("displayUsername").innerText = username;
        document.getElementById("userAvatar").innerText = username
            .charAt(0)
            .toUpperCase();
        document.getElementById("displayBranch").innerText =
            branch.toUpperCase();
        document.getElementById("displayYear").innerText = `Lvl ${year}`;

        // --- INITIALIZATION ---
        function initGame() {
            // Generate long text by joining random paragraphs
            let text = "";
            for (let i = 0; i < 10; i++) {
                // Generate enough text for 5 mins
                text +=
                    PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)] +
                    " ";
            }
            currentText = text.trim();

            // Render text
            textDisplay.innerHTML = "";
            currentText.split("").forEach((char) => {
                let span = document.createElement("span");
                span.innerText = char;
                textDisplay.appendChild(span);
            });

            // Set initial active char
            textDisplay.querySelectorAll("span")[0].classList.add("active");

            // Event Listeners
            inputField.addEventListener("input", initTyping);
            inputField.addEventListener("blur", () => {
                focusOverlay.classList.remove("hidden");
                isFocused = false;
            });

            focusOverlay.addEventListener("click", () => {
                inputField.focus();
                focusOverlay.classList.add("hidden");
                isFocused = true;
            });

            // Focus initially
            // document.addEventListener('keydown', () => inputField.focus());
        }

        function initTyping() {
            const chars = textDisplay.querySelectorAll("span");
            let typedChar = inputField.value.split("")[charIndex];

            if (!isRunning && inputField.value.length > 0) {
                // Start Timer
                isRunning = true;
                timer = setInterval(updateTimer, 1000);
            }

            // Handle backspace or data entry
            if (inputField.value.length < charIndex) {
                // Must have backspaced
                // Not strictly supporting backspace in this simple "stream" implementation
                // usually, but let's handle it for basic usability
                if (charIndex > 0) {
                    chars[charIndex].classList.remove("active");
                    charIndex--;
                    chars[charIndex].classList.remove("correct", "incorrect");
                    chars[charIndex].classList.add("active");
                }
                // Reset input content to match valid charIndex to prevent desync
                // Ideally we don't clear value, but for simple matching:
                return;
            }

            // If we are here, we typed a character
            if (typedChar == null) return; // Ghost input check

            if (chars[charIndex].innerText === typedChar) {
                chars[charIndex].classList.add("correct");
            } else {
                mistakes++;
                chars[charIndex].classList.add("incorrect");
            }

            chars[charIndex].classList.remove("active");
            charIndex++;

            if (charIndex < chars.length) {
                chars[charIndex].classList.add("active");

                // Auto-scroll logic if needed (simple version)
                if (
                    chars[charIndex].offsetTop >
                    textDisplay.clientHeight - 60
                ) {
                    // textDisplay.scrollTop += 30; // Manual scroll or just let overflow hide
                    // Improved scroll:
                    chars[charIndex].scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                    });
                }
            } else {
                // End of text (unlikely in 5 mins with correct generation, but possible)
                clearInterval(timer);
                finishTest();
            }

            // Calculate stats
            let wpm = Math.round(
                (charIndex - mistakes) / 5 / ((TIME_LIMIT - timeLeft) / 60),
            );
            wpm = wpm < 0 || !wpm || wpm === Infinity ? 0 : wpm;

            let accuracy = Math.round(
                ((charIndex - mistakes) / charIndex) * 100,
            );
            accuracy = accuracy < 0 || !accuracy ? 100 : accuracy;

            wpmElement.innerText = wpm;
            accElement.innerText = accuracy + "%";
        }

        function updateTimer() {
            if (timeLeft > 0) {
                timeLeft--;
                let min = Math.floor(timeLeft / 60);
                let sec = timeLeft % 60;
                timerElement.innerText = `${min}:${sec < 10 ? "0" + sec : sec}`;
            } else {
                clearInterval(timer);
                finishTest();
            }
        }

        function finishTest() {
            inputField.disabled = true;
            isRunning = false;

            // Final Calcs
            let wpm = wpmElement.innerText;
            let acc = accElement.innerText;

            document.getElementById("finalWpm").innerText = wpm;
            document.getElementById("finalAcc").innerText = acc;
            document.getElementById("finalChars").innerText = charIndex;

            resultModal.classList.add("show");
        }

        initGame();
    });
</script>

<div class="container">
    <!-- Header -->
    <header class="test-header">
        <div class="user-info">
            <div class="user-avatar" id="userAvatar">U</div>
            <div>
                <div class="user-name" id="displayUsername">Commander</div>
                <div class="user-details">
                    <span id="displayBranch">UNK</span> •
                    <span id="displayYear">Lvl ?</span>
                </div>
            </div>
        </div>

        <div class="test-stats">
            <div class="stat-box">
                <div class="stat-label">Time</div>
                <div class="stat-value timer" id="timer">05:00</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">WPM</div>
                <div class="stat-value" id="wpm">0</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Acc</div>
                <div class="stat-value" id="accuracy">100%</div>
            </div>
        </div>
    </header>

    <!-- Typing Area -->
    <div class="typing-area" onclick={() => {}}>
        <div class="text-display" id="textDisplay"></div>
        <input
            type="text"
            id="inputField"
            class="input-hidden"
            autocomplete="off"
        />

        <div class="focus-overlay" id="focusOverlay">
            <div class="focus-text">CLICK TO INITIALIZE TYPE LINK</div>
        </div>

        <div class="difficulty-badge">Protocol: DIFFICULT</div>
    </div>
</div>

<!-- Results Modal -->
<div class="result-modal" id="resultModal">
    <div class="result-card">
        <h2 class="result-title">Session Complete</h2>
        <p class="result-subtitle">
            Data upload successful. Performance metrics analysis:
        </p>

        <div class="result-grid">
            <div class="result-item">
                <h4>WPM</h4>
                <div class="val" id="finalWpm">0</div>
            </div>
            <div class="result-item">
                <h4>Accuracy</h4>
                <div class="val" id="finalAcc">0%</div>
            </div>
            <div class="result-item">
                <h4>Raw Characters</h4>
                <div class="val" id="finalChars">0</div>
            </div>
            <div class="result-item">
                <h4>Time Elapsed</h4>
                <div class="val">5:00</div>
            </div>
        </div>

        <button class="btn-restart" onclick={() => {}}>Re-Initialize</button>
    </div>
</div>
