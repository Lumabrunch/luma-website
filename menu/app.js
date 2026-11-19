let data,lang='es',selected=0;const $=s=>document.querySelector(s);const ui={es:{headline:'Tu momento<br><i>Luma.</i>',intro:'Algo rico, algo fresco.<br>Un momento para disfrutar.',discover:'Descubre nuestra carta',search:'¿Qué te apetece?',menu:'NUESTRA CARTA',results:'Resultados',none:'No encontramos ningún producto.',story:'Nuestra filosofía',close:'Cerrar',footer:'Preparado al momento, con cariño.\n¿Tienes alguna alergia? Consulta con nuestro equipo.',top:'Volver arriba'},en:{headline:'Your little<br><i>Luma moment.</i>',intro:'Something fresh, something delicious.<br>A moment to enjoy.',discover:'Explore our menu',search:'What are you craving?',menu:'OUR MENU',results:'Search results',none:'No products found.',story:'Our philosophy',close:'Close',footer:'Freshly prepared, with love.\nHave an allergy? Please speak to our team.',top:'Back to top'},nl:{headline:'Jouw moment<br><i>Luma.</i>',intro:'Iets lekkers, iets vers.<br>Een moment om te genieten.',discover:'Ontdek ons menu',search:'Waar heb je zin in?',menu:'ONS MENU',results:'Zoekresultaten',none:'Geen producten gevonden.',story:'Ons verhaal',close:'Sluiten',footer:'Vers bereid, met liefde.\nHeb je een allergie? Vraag het aan ons team.',top:'Terug naar boven'}};
function el(tag,cls,text){let e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}function itemCard(item){let a=el('article','item'),row=el('div','item-top');row.append(el('h3','',item.name[lang]),el('span','price','€ '+item.price));a.append(row);if(item.description[lang])a.append(el('p','',item.description[lang].replaceAll('•','\n• ').replaceAll('.Topping','. Topping')));if(item.photo) a.append(dishPhoto(item));return a}
function dishPhoto(item) {
  const labels = {
    es: ['Ver foto', 'Ocultar foto'],
    en: ['View photo', 'Hide photo'],
    nl: ['Bekijk foto', 'Verberg foto']
  };
  const [show, hide] = labels[lang];
  const dishName = item.name[lang];
  const details = el('details', 'dish-photo');
  const summary = el('summary', '', show);
  const photo = el('img', 'dish-photo-image');
  photo.alt = dishName;
  details.append(summary, photo);
  function updateLabel() {
    const label = details.open ? hide : show;
    summary.textContent = label;
    summary.setAttribute('aria-label', label + ': ' + dishName);
    if (details.open && !photo.hasAttribute('src')) photo.src = item.photo;
  }
  details.addEventListener('toggle', updateLabel);
  updateLabel();
  return details;
}
function setActive(index){selected=index;document.querySelectorAll('#tabs button').forEach((b,i)=>{b.classList.toggle('active',i===index);if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});let active=$('#tabs button.active'),nav=$('#tabs');if(active){let x=active.offsetLeft-nav.offsetLeft;if(x<nav.scrollLeft||x+active.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:Math.max(0,x-20),behavior:'smooth'})}}
function jumpTo(index){let section=document.getElementById('category-'+index);if(!section)return;setActive(index);window.scrollTo({top:window.scrollY+section.getBoundingClientRect().top-$('.menu-tools').offsetHeight-15,behavior:'smooth'})}
let scrollQueued=false;window.addEventListener('scroll',()=>{if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{scrollQueued=false;if(!data||$('#search').value.trim())return;let boundary=$('.menu-tools').getBoundingClientRect().bottom+35,sections=[...document.querySelectorAll('.category-section')],current=0;for(let section of sections){if(section.getBoundingClientRect().top<=boundary)current=Number(section.dataset.index);else break}if(current!==selected)setActive(current)})},{passive:true});
function categoryNotes(category) {
  const extrasTitle = {es: 'Extras:', en: 'Extras:', nl: 'Extra’s:'}[lang];
  if (category.title.es !== 'Tostadas') {
    const notes = el('aside', 'notes');
    if (category.title.es === 'Croissants') {
      const heading = el('h4', '');
      heading.append(el('strong', '', extrasTitle));
      notes.append(heading);
    }
    notes.append(...category.notes.map(note => el('p', '', note[lang])));
    return notes;
  }

  const breadHeading = category.notes.findIndex(note => note.es === 'Elige tu pan:');
  const breadTitle = category.notes[breadHeading][lang];
  const groups = [
    [extrasTitle, category.notes.slice(0, breadHeading)],
    [breadTitle, category.notes.slice(breadHeading + 1)]
  ];
  const options = el('aside', 'notes tostada-options');
  options.setAttribute('aria-label', extrasTitle + ' · ' + breadTitle);
  for (const [title, notes] of groups) {
    const group = el('div', 'tostada-option-group');
    const list = el('ul', '');
    for (const note of notes) {
      const [label, surcharge] = note[lang].split(' + ');
      const row = el('li', '');
      row.append(el('span', '', label));
      if (surcharge) row.append(el('strong', '', '+ ' + surcharge));
      list.append(row);
    }
    const heading = el('h4', '');
    heading.append(el('strong', '', title));
    group.append(heading, list);
    options.append(group);
  }
  return options;
}
function render(){const t=ui[lang],q=$('#search').value.toLocaleLowerCase().trim();document.documentElement.lang=lang;$('#headline').innerHTML=t.headline;$('#intro').innerHTML=t.intro;$('#discover').innerHTML=t.discover+' <span>↓</span>';$('#search').placeholder=t.search;$('#search').setAttribute('aria-label',t.search);$('#menu-eyebrow').textContent=t.menu;$('#footer-text').textContent=t.footer;$('#footer-text').style.whiteSpace='pre-line';$('#top-label').textContent=t.top;$('#fresh-stamp').textContent={es:'HECHO AL MOMENTO\nCON CARIÑO',en:'MADE FRESH\nWITH LOVE',nl:'VERS BEREID\nMET LIEFDE'}[lang];$('#fresh-title').textContent=data.story[lang][0];$('#fresh-text').textContent=data.story[lang][1];$('#story').replaceChildren(...data.story[lang].slice(2).map(x=>el('p','',x)));$('#story-button').textContent=$('#story').hidden?t.story:t.close;document.querySelectorAll('[data-lang]').forEach(b=>{b.classList.toggle('selected',b.dataset.lang===lang);b.setAttribute('aria-pressed',b.dataset.lang===lang)});$('#tabs').replaceChildren(...data.categories.map((c,i)=>{let b=el('button',i===selected&&!q?'active':'',c.title[lang]);b.onclick=()=>{if($('#search').value){$('#search').value='';render()}jumpTo(i)};return b}));let content=$('#content');content.replaceChildren();let total=0;data.categories.forEach((c,i)=>{let items=c.items.filter(x=>!q||(x.name[lang]+' '+x.description[lang]).toLocaleLowerCase().includes(q));if(!items.length)return;let section=el('section','category-section');section.id='category-'+i;section.dataset.index=i;let heading=el('h2','section-title',c.title[lang]);section.setAttribute('aria-labelledby','category-heading-'+i);heading.id='category-heading-'+i;section.append(heading);let grid=el('div','items');items.forEach(item=>grid.append(itemCard(item)));section.append(grid);total+=items.length;if(!q&&c.notes.length)section.append(categoryNotes(c));content.append(section)});if(!total)content.append(el('p','empty',t.none));$('#category-title').textContent=q?t.results:{es:'La carta',en:'The menu',nl:'De menukaart'}[lang];$('#count').textContent=total;if(!q)setActive(selected);}
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{lang=b.dataset.lang;localStorage.setItem('luma-language',lang);render()});$('#search').addEventListener('input',render);$('#story-button').onclick=()=>{$('#story').hidden=!$('#story').hidden;$('#story-button').setAttribute('aria-expanded',!$('#story').hidden);render()};$('#top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});fetch('menu.json?v=2').then(r=>r.json()).then(d=>{data=d;const requested=new URLSearchParams(location.search).get('lang');const saved=localStorage.getItem('luma-language');if(Object.hasOwn(ui,requested))lang=requested;else if(Object.hasOwn(ui,saved))lang=saved;render()}).catch(()=>{$('#content').textContent='No se ha podido cargar la carta. Vuelve a intentarlo.'});
