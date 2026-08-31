const SOUTH_SECTIONS = [
  { href: '/real.html', label: 'Dashboard' },
  { href: '/south/daily.html', label: 'Daily punishments' },
  { href: '/south/employment.html', label: 'Employment' },
  { href: '/south/money.html', label: 'Move money badly' },
  { href: '/south/crime.html', label: 'Crime desk' },
  { href: '/south/loans.html', label: 'Loans we should not offer' },
  { href: '/south/casino.html', label: 'Casino annex' },
  { href: '/south/crypto.html', label: 'Crypto that mostly goes down' },
  { href: '/south/insurance.html', label: 'Insurance (claims denied)' },
  { href: '/south/investments.html', label: 'Investments' },
  { href: '/south/lottery.html', label: "Kevin's Numbers" },
  { href: '/south/shop.html', label: 'Gift shop (all sales final)' },
  { href: '/south/shaming.html', label: 'Public shaming' },
];

function injectSouthNav() {
  const host = document.getElementById('southNav');
  if (!host) return;
  const path = window.location.pathname.replace(/\/$/, '');
  const list = document.createElement('ul');
  SOUTH_SECTIONS.forEach(section => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = section.href;
    link.textContent = section.label;
    const sectionPath = section.href.replace(/\.html$/, '');
    if (path === section.href || path === sectionPath || path.endsWith(section.href)) {
      link.setAttribute('aria-current', 'page');
    }
    item.appendChild(link);
    list.appendChild(item);
  });
  host.replaceChildren(list);
}

document.addEventListener('DOMContentLoaded', injectSouthNav);
