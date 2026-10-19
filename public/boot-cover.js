// This independent fallback still runs if the game module fails to boot.
setTimeout(function () {
    var cover = document.getElementById('boot-cover');
    if (cover) cover.classList.add('hidden');
}, 4000);
