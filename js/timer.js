let timerInterval = null;

function startTimer(seconds, title) {
  clearInterval(timerInterval);
  document.getElementById("timer-title").innerText = title;
  const modal = document.getElementById("timer-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  let remain = seconds;
  updateTimerDisplay(remain);

  timerInterval = setInterval(() => {
    remain--;
    updateTimerDisplay(remain);
    if (remain <= 0) {
      clearInterval(timerInterval);
      if (typeof playChime === "function") playChime();
      alert("කාලය අවසන්! විශිෂ්ටයි 🎉");
      stopTimer();
    }
  }, 1000);
}

function updateTimerDisplay(remain) {
  const m = String(Math.floor(remain / 60)).padStart(2, '0');
  const s = String(remain % 60).padStart(2, '0');
  document.getElementById("timer-display").innerText = `${m}:${s}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  const modal = document.getElementById("timer-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}
