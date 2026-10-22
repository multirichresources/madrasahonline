// Tema & saiz tulisan sebelum halaman dilukis (fail berasingan kerana CSP tidak benarkan skrip sebaris)
try { var t = localStorage.getItem('mo-theme'); if (t) document.documentElement.setAttribute('data-theme', t); if (localStorage.getItem('mo-big') === '1') document.documentElement.classList.add('big'); } catch (e) {}
