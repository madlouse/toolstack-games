(function () {
  var board = document.getElementById("ng-board");
  if (!board) return;
  var grid = board.querySelector(".ng-grid");
  var win = document.getElementById("ng-win");
  var clearBtn = document.getElementById("ng-clear");
  if (!grid) return;
  var solution = board.getAttribute("data-solution") || "";
  var cells = grid.querySelectorAll(".ng-cell");

  function paint(cell, on) {
    cell.classList.toggle("is-on", on);
    cell.setAttribute("aria-pressed", on ? "true" : "false");
    var label = cell.getAttribute("aria-label") || "";
    var base = label.replace(/ filled$| empty$/, "");
    cell.setAttribute("aria-label", base + (on ? " filled" : " empty"));
  }

  function check() {
    if (cells.length !== solution.length) return;
    for (var i = 0; i < cells.length; i++) {
      var on = cells[i].classList.contains("is-on");
      if (on !== (solution.charAt(i) === "1")) return;
    }
    board.setAttribute("data-state", "won");
    if (win) {
      win.hidden = false;
      win.setAttribute("data-win", "1");
    }
  }

  grid.addEventListener("click", function (event) {
    var cell = event.target && event.target.closest ? event.target.closest(".ng-cell") : null;
    if (!cell || !grid.contains(cell)) return;
    if (board.getAttribute("data-state") === "won") return;
    paint(cell, !cell.classList.contains("is-on"));
    check();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (board.getAttribute("data-state") === "won") return;
      for (var i = 0; i < cells.length; i++) paint(cells[i], false);
    });
  }
})();
