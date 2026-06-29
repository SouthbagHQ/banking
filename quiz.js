// Reusable Quiz Renderer
// Copy quiz1.html and edit the JSON block to reuse for other modules.
(function() {
  function $(sel) { return document.querySelector(sel); }

  const dataEl = $("#quiz-data");
  if (!dataEl) {
    console.warn("quiz-data element not found");
    return;
  }

  let quiz; 
  try {
    quiz = JSON.parse(dataEl.textContent.trim());
  } catch (e) {
    console.error("Invalid quiz JSON", e);
    return;
  }

  const container = document.createElement("div");
  container.className = "quiz-container";

  const title = document.createElement("h1");
  title.textContent = quiz.title || "Quiz";
  container.appendChild(title);

  if (quiz.description) {
    const desc = document.createElement("p");
    desc.textContent = quiz.description;
    container.appendChild(desc);
  }

  const form = document.createElement("form");
  form.id = "quiz-form";

  quiz.questions.forEach((q, qi) => {
    const section = document.createElement("section");
    section.className = "quiz-question";

    const h = document.createElement("h3");
    h.textContent = `Q${qi+1}. ${q.text}`;
    section.appendChild(h);

    const groupName = `q-${qi}`;

    q.options.forEach((opt, oi) => {
      const label = document.createElement("label");
      label.className = "quiz-option";

      const input = document.createElement("input");
      input.type = q.type === "multiple" ? "checkbox" : "radio";
      input.name = groupName;
      input.value = String(oi);

      label.appendChild(input);
      const span = document.createElement("span");
      span.textContent = opt.label;
      label.appendChild(span);

      section.appendChild(label);
    });

    form.appendChild(section);
  });

  const actions = document.createElement("div");
  actions.className = "quiz-actions";

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Submit";
  submitBtn.addEventListener("click", () => {
    const results = grade();
    renderResults(results);
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => {
    form.reset();
    const resultsEl = $("#quiz-results");
    if (resultsEl) resultsEl.remove();
  });

  actions.appendChild(submitBtn);
  actions.appendChild(resetBtn);
  form.appendChild(actions);

  container.appendChild(form);
  const mount = $("#quiz");
  if (mount) {
    mount.innerHTML = "";
    mount.appendChild(container);
  } else {
    document.body.appendChild(container);
  }

  function grade() {
    let correct = 0;
    const detail = [];

    quiz.questions.forEach((q, qi) => {
      const name = `q-${qi}`;
      const inputs = Array.from(form.querySelectorAll(`[name="${name}"]`));
      let userIndices = [];

      if (q.type === "multiple") {
        userIndices = inputs.filter(i => i.checked).map(i => Number(i.value));
      } else {
        const checked = inputs.find(i => i.checked);
        if (checked) userIndices = [Number(checked.value)];
      }

      const correctIndices = q.options
        .map((o, idx) => (o.isCorrect ? idx : null))
        .filter(idx => idx !== null);

      const isCorrect = arraysEqual(new Set(userIndices), new Set(correctIndices));
      if (isCorrect) correct += 1;

      detail.push({
        question: q.text,
        correct,
        isCorrect,
        userAnswer: userIndices.map(i => q.options[i]?.label).filter(Boolean),
        correctAnswer: correctIndices.map(i => q.options[i]?.label).filter(Boolean),
        explanation: q.explanation || ""
      });
    });

    return { total: quiz.questions.length, correct, detail };
  }

  function arraysEqual(aSet, bSet) {
    if (aSet.size !== bSet.size) return false;
    for (const v of aSet) if (!bSet.has(v)) return false;
    return true;
  }

  function renderResults(results) {
    let resultsEl = $("#quiz-results");
    if (!resultsEl) {
      resultsEl = document.createElement("div");
      resultsEl.id = "quiz-results";
      resultsEl.className = "quiz-results";
      container.appendChild(resultsEl);
    }

    const score = Math.round((results.correct / results.total) * 100);
    const passingScore = 70;
    const isPassing = score >= passingScore;
    
    let summary = `<h2>Score: ${results.correct}/${results.total} (${score}%)</h2>`;
    
    if (isPassing) {
      summary += `<p style="color: green; font-weight: bold;">✅ Training completed successfully! You scored ${score}%.</p>`;
    } else {
      summary += `<p style="color: red; font-weight: bold;">❌ You need at least ${passingScore}% to pass. Please try again.</p>`;
    }

    const items = results.detail.map((d, i) => {
      const status = d.isCorrect ? "✅ Correct" : "❌ Incorrect";
      const user = d.userAnswer.length ? d.userAnswer.join(", ") : "No answer";
      const correct = d.correctAnswer.join(", ");
      const expl = d.explanation ? `<div class=\"explanation\">${escapeHtml(d.explanation)}</div>` : "";
      return `<div class=\"result-item\">` +
             `<h4>Q${i+1}: ${escapeHtml(d.question)} — ${status}</h4>` +
             `<div><strong>Your answer:</strong> ${escapeHtml(user)}</div>` +
             `<div><strong>Correct answer:</strong> ${escapeHtml(correct)}</div>` +
             `${expl}` +
             `</div>`;
    }).join("");

    resultsEl.innerHTML = summary + items;
    
    // If passing, show the next required training step
    if (isPassing) {
      var path = window.location.pathname || '';
      var nextPage = '../index.html';
      var nextLabel = 'Continue to Login Portal';
      
      if (path.includes('quiz1.html')) {
        try {
          localStorage.setItem('sb_module1_complete', 'true');
        } catch (e) {}
        nextPage = 'module2.html';
        nextLabel = 'Continue to Module 2';
      } else if (path.includes('quiz2.html')) {
        try {
          localStorage.setItem('sb_module2_complete', 'true');
          localStorage.setItem('sb_training_complete', 'true');
        } catch (e) {}
        nextPage = 'modules-complete.html';
        nextLabel = 'Complete Training';
      }
      
      resultsEl.innerHTML = summary + items +
        `<p><button type="button" id="quiz-next-step" class="btn-small">${escapeHtml(nextLabel)}</button></p>`;

      const nextButton = document.getElementById('quiz-next-step');
      if (nextButton) {
        nextButton.addEventListener('click', () => {
          window.location.href = nextPage;
        });
      }
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

})();
