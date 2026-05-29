function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    for (let c of document.cookie.split(';')) {
        c = c.trim();
        if (c.indexOf(nameEQ) === 0)
            return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
}

function deleteAllCookies() {
    document.cookie.split(';').forEach(function (c) {
        deleteCookie(c.split('=')[0].trim());
    });
}

function acceptaCookies() {
    setCookie('cookies_acceptate', '1', 1);
    const banner = document.getElementById('banner-cookies');
    if (banner) banner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const banner = document.getElementById('banner-cookies');
    if (!banner) return;
    if (getCookie('cookies_acceptate')) {
        banner.style.display = 'none';
        return;
    }
    banner.classList.add('animeaza');
});
