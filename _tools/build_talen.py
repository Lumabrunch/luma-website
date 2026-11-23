"""Maakt en/index.html en nl/index.html uit de Spaanse homepage (index.html).
Gebruik na ELKE wijziging van index.html:  python3 _tools/build_talen.py
Elke Spaanse tekst hieronder moet in index.html staan; anders stopt het script
(dan is er een tekst veranderd en moet de vertaling hier mee aangepast worden).
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'index.html').read_text(encoding='utf8')

# (Spaans zoals in index.html, Engels, Nederlands)
T = [
 # --- head ---
 ('<meta name="description" content="Brunch, desayunos y café en Benijófar, a un paso de Ciudad Quesada y Rojales. Tostadas, bowls, smoothies y zumos naturales. Lun–sáb 9:00–16:00.">',
  '<meta name="description" content="Brunch, breakfast and coffee in Benijófar, close to Ciudad Quesada and Rojales. Toasts, bowls, smoothies and fresh juices. Mon–Sat 9:00–16:00.">',
  '<meta name="description" content="Brunch, ontbijt en koffie in Benijófar, vlak bij Ciudad Quesada en Rojales. Toasts, bowls, smoothies en verse sappen. Ma–za 9:00–16:00.">'),
 ('<title>Brunch y desayunos en Benijófar | Luma Brunch &amp; Coffee</title>',
  '<title>Brunch &amp; breakfast in Benijófar | Luma Brunch &amp; Coffee</title>',
  '<title>Brunch en ontbijt in Benijófar | Luma Brunch &amp; Coffee</title>'),
 ('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="en_GB">', '<meta property="og:locale" content="nl_NL">'),
 ('<meta property="og:title" content="Luma Brunch · Brunch y café en Benijófar">',
  '<meta property="og:title" content="Luma Brunch · Brunch &amp; coffee in Benijófar">',
  '<meta property="og:title" content="Luma Brunch · Brunch &amp; koffie in Benijófar">'),
 ('<meta property="og:description" content="Brunch, desayunos, smoothies y bowls preparados al momento. Lun–sáb 9:00–16:00, Calle Aneto, Benijófar.">',
  '<meta property="og:description" content="Brunch, breakfast, smoothies and bowls made to order. Mon–Sat 9:00–16:00, Calle Aneto, Benijófar.">',
  '<meta property="og:description" content="Brunch, ontbijt, smoothies en bowls, vers bereid. Ma–za 9:00–16:00, Calle Aneto, Benijófar.">'),
 ('<meta property="og:image:alt" content="Tortitas de Luma Brunch con manzana y canela">',
  '<meta property="og:image:alt" content="Luma Brunch pancakes with apple and cinnamon">',
  '<meta property="og:image:alt" content="Pannenkoekjes van Luma Brunch met appel en kaneel">'),
 # --- header ---
 ('Saltar al contenido', 'Skip to content', 'Naar de inhoud'),
 ('aria-label="Navegación principal"', 'aria-label="Main navigation"', 'aria-label="Hoofdnavigatie"'),
 ('<a href="carta/">La carta</a><a class="button outline" href="#visitanos">Visítanos</a>',
  '<a href="carta/">Menu</a><a class="button outline" href="#visitanos">Visit us</a>',
  '<a href="carta/">Menukaart</a><a class="button outline" href="#visitanos">Bezoek ons</a>'),
 # --- hero ---
 ('<span class="eyebrow hero-kicker">Brunch &amp; café en Benijófar</span>Tu momento <span>Luma.</span>',
  '<span class="eyebrow hero-kicker">Brunch &amp; coffee in Benijófar</span>Your Luma <span>moment.</span>',
  '<span class="eyebrow hero-kicker">Brunch &amp; koffie in Benijófar</span>Jouw Luma-<span>moment.</span>'),
 ('Un café, algo rico y tiempo para disfrutar. Te esperamos en Luma.',
  'A good coffee, something tasty and time to enjoy it. See you at Luma.',
  'Een goede koffie, iets lekkers en tijd om te genieten. Tot snel bij Luma.'),
 ('<span id="opening-label">Horario</span><span class="detail" id="opening-detail"> · Lun–sáb 09:00–16:00</span>',
  '<span id="opening-label">Opening hours</span><span class="detail" id="opening-detail"> · Mon–Sat 09:00–16:00</span>',
  '<span id="opening-label">Openingstijden</span><span class="detail" id="opening-detail"> · Ma–za 09:00–16:00</span>'),
 ('<a class="button" href="carta/">Descubre la carta</a><a class="text-link" href="#visitanos">Ven a conocernos</a>',
  '<a class="button" href="carta/">See the menu</a><a class="text-link" href="#visitanos">Come and visit</a>',
  '<a class="button" href="carta/">Bekijk de menukaart</a><a class="text-link" href="#visitanos">Kom langs</a>'),
 ('alt="Letrero luminoso de Luma Brunch en el interior del local, Benijófar"',
  'alt="Luma Brunch neon sign inside the café, Benijófar"',
  'alt="Neonbord van Luma Brunch binnen in de zaak, Benijófar"'),
 # --- welkom ---
 ('<p class="eyebrow">Bienvenido a Luma</p>', '<p class="eyebrow">Welcome to Luma</p>', '<p class="eyebrow">Welkom bij Luma</p>'),
 ('Siéntate. Respira.<br>Disfruta de la pausa.', 'Sit down. Breathe.<br>Enjoy the pause.', 'Ga zitten. Adem in.<br>Geniet van de pauze.'),
 ('En Luma, una tostada y un café pueden ser el comienzo de la mañana. Si vienes con ganas de quedarte un rato más, hay sitio para compartir un brunch o pedir algo dulce. Nos encuentras en Benijófar, a un paso de Ciudad Quesada y Rojales.',
  'At Luma, a slice of toast and a coffee can be the start of your morning. Fancy staying a little longer? There is room to share a brunch or order something sweet. You will find us in Benijófar, just around the corner from Ciudad Quesada and Rojales.',
  'Bij Luma kan een toast met een kop koffie het begin van je ochtend zijn. Zin om wat langer te blijven? Er is plek om samen te brunchen of iets zoets te bestellen. Je vindt ons in Benijófar, vlak bij Ciudad Quesada en Rojales.'),
 # --- foto's ---
 ('<p class="eyebrow">Recién hecho en Luma</p><h2 id="bar-title">Luma en imágenes</h2>',
  '<p class="eyebrow">Freshly made at Luma</p><h2 id="bar-title">Luma in pictures</h2>',
  '<p class="eyebrow">Vers gemaakt bij Luma</p><h2 id="bar-title">Luma in beeld</h2>'),
 ('>Más en Instagram<', '>More on Instagram<', '>Meer op Instagram<'),
 ('<span>Tortitas de Luma</span>', '<span>Luma pancakes</span>', '<span>Luma-pannenkoekjes</span>'),
 # --- bezoek ---
 ('<img src="home-assets/interior.webp" alt="Interior de Luma Brunch"', '<img src="home-assets/interior.webp" alt="Inside Luma Brunch"', '<img src="home-assets/interior.webp" alt="Interieur van Luma Brunch"'),
 ('<p class="eyebrow">Nos vemos en Benijófar</p><h2 id="visit-title">Tu próxima pausa empieza aquí.</h2>',
  '<p class="eyebrow">See you in Benijófar</p><h2 id="visit-title">Your next break starts here.</h2>',
  '<p class="eyebrow">Tot ziens in Benijófar</p><h2 id="visit-title">Je volgende pauze begint hier.</h2>'),
 ('>Cómo llegar · Google Maps<', '>Directions · Google Maps<', '>Route · Google Maps<'),
 ('title="Luma Brunch · C. Aneto, Local 13, en Google Maps"', 'title="Luma Brunch · C. Aneto, Local 13, on Google Maps"', 'title="Luma Brunch · C. Aneto, Local 13, op Google Maps"'),
 ('&amp;hl=es&amp;output=embed', '&amp;hl=en&amp;output=embed', '&amp;hl=nl&amp;output=embed'),
 ('<strong>Lunes a Sábado</strong>', '<strong>Monday to Saturday</strong>', '<strong>Maandag t/m zaterdag</strong>'),
 ('<strong>Domingo</strong> · Cerrado', '<strong>Sunday</strong> · Closed', '<strong>Zondag</strong> · Gesloten'),
 ('Consulta posibles cambios de horario en', 'Check for any changes to our opening hours on', 'Eventuele wijzigingen in de openingstijden zie je op'),
 # --- reviews ---
 ('Reseñas de Google', 'Google reviews', 'Google-reviews'),
 ('150 reseñas en Google', '150 reviews on Google', '150 reviews op Google'),
 ('Leer las reseñas en Google Maps', 'Read the reviews on Google Maps', 'Lees de reviews op Google Maps'),
 ('¿Cómo fue tu visita a Luma?', 'How was your visit to Luma?', 'Hoe was je bezoek aan Luma?'),
 ('Cuéntanos tu experiencia. Escanea el código o abre el formulario de Google.', 'Tell us about it. Scan the code or open the Google form.', 'Vertel ons hoe het was. Scan de code of open het formulier van Google.'),
 ('>Escribir una reseña<', '>Write a review<', '>Schrijf een review<'),
 ('aria-label="Abrir el formulario de reseñas de Google"', 'aria-label="Open the Google review form"', 'aria-label="Open het reviewformulier van Google"'),
 ('Código QR para escribir una reseña de Luma Brunch en Google', 'QR code to write a Google review for Luma Brunch', 'QR-code om een Google-review voor Luma Brunch te schrijven'),
 # --- carta-blok ---
 ('<h2 id="menu-title">La carta de Luma</h2>', '<h2 id="menu-title">The Luma menu</h2>', '<h2 id="menu-title">De kaart van Luma</h2>'),
 ('Cafés, smoothies, bowls, tostadas y brunch, todo preparado al momento. En español, English y Nederlands.',
  'Coffee, smoothies, bowls, toasts and brunch, all made to order. In Spanish, English and Dutch.',
  'Koffie, smoothies, bowls, toasts en brunch, alles vers bereid. In het Spaans, Engels en Nederlands.'),
 ('<a class="button" href="carta/">Ver la carta</a>', '<a class="button" href="carta/">View the menu</a>', '<a class="button" href="carta/">Bekijk de kaart</a>'),
 # --- footer + nieuwsbrief ---
 ('¿Quieres estar al día de todas las novedades?', 'Want to hear about everything new at Luma?', 'Op de hoogte blijven van alles wat nieuw is?'),
 ('Un momento Luma<br><span>en tu correo.</span>', 'A Luma moment<br><span>in your inbox.</span>', 'Een Luma-moment<br><span>in je mailbox.</span>'),
 ('Recibe las novedades de Luma, los especiales de brunch y las bebidas de temporada.', 'Get Luma news, brunch specials and seasonal drinks.', 'Ontvang nieuws van Luma, brunch-specials en seizoensdrankjes.'),
 ('<span>Nombre</span>', '<span>Name</span>', '<span>Naam</span>'),
 ('<span>Correo electrónico</span>', '<span>Email</span>', '<span>E-mailadres</span>'),
 ('placeholder="nombre@ejemplo.com"', 'placeholder="name@example.com"', 'placeholder="naam@voorbeeld.nl"'),
 ('Acepto recibir correos de Luma Brunch con novedades y ofertas. Puedo darme de baja en cualquier momento.',
  'I agree to receive emails from Luma Brunch with news and offers. I can unsubscribe at any time.',
  'Ik ga akkoord met e-mails van Luma Brunch met nieuws en aanbiedingen. Ik kan me op elk moment afmelden.'),
 ('>Suscribirme<', '>Subscribe<', '>Aanmelden<'),
 ('¡Gracias!', 'Thank you!', 'Bedankt!'),
 ('Ya estás en la lista. Muy pronto recibirás nuestras novedades.', 'You are on the list. Our news will be with you soon.', 'Je staat op de lijst. Binnenkort ontvang je ons nieuws.'),
 ('Luma Brunch usará tu nombre y correo solo para enviarte novedades. Puedes darte de baja en cualquier momento desde el enlace de nuestros correos.',
  'Luma Brunch will only use your name and email to send you news. You can unsubscribe at any time via the link in our emails.',
  'Luma Brunch gebruikt je naam en e-mailadres alleen om je nieuws te sturen. Je kunt je altijd afmelden via de link in onze e-mails.'),
 ('aria-label="Cerrar"', 'aria-label="Close"', 'aria-label="Sluiten"'),
 ('<button class="button outline">Cerrar</button>', '<button class="button outline">Close</button>', '<button class="button outline">Sluiten</button>'),
 # --- scripts ---
 ('"Abrimos mañana a las 09:00"', '"Open tomorrow at 09:00"', '"Morgen open om 09:00"'),
 ('"Abrimos hoy a las 09:00"', '"Open today at 09:00"', '"Vandaag open om 09:00"'),
 ('"Abrimos el lunes a las 09:00"', '"Open Monday at 09:00"', '"Maandag open om 09:00"'),
 ('"Abierto ahora", "Hasta las 16:00"', '"Open now", "Until 16:00"', '"Nu open", "Tot 16:00"'),
 ('"Cerrado"', '"Closed"', '"Gesloten"'),
 ("'Revisa tu correo electrónico.'", "'Please check your email address.'", "'Controleer je e-mailadres.'"),
 ("'Marca la casilla para poder suscribirte.'", "'Please tick the box to subscribe.'", "'Vink het vakje aan om je aan te melden.'"),
 ("'Enviando…'", "'Sending…'", "'Bezig…'"),
 ("'Algo ha fallado. Inténtalo de nuevo en un momento.'", "'Something went wrong. Please try again in a moment.'", "'Er ging iets mis. Probeer het zo nog eens.'"),
 ("btn.textContent = 'Suscribirme'", "btn.textContent = 'Subscribe'", "btn.textContent = 'Aanmelden'"),
]

def build(lang, col):
    s = SRC
    for row in T:
        es, tr = row[0], row[col]
        n = s.count(es)
        if n == 0: sys.exit(f'[{lang}] niet gevonden in index.html: {es[:90]}')
        s = s.replace(es, tr)
    url = f'https://luma-brunch.es/{lang}/'
    def rep(a, b, cnt=1):
        nonlocal s
        if s.count(a) != cnt: sys.exit(f'[{lang}] verwacht {cnt}x: {a[:90]} (gevonden {s.count(a)})')
        s = s.replace(a, b)
    rep('<html lang="es">', f'<html lang="{lang}">')
    rep('<link rel="canonical" href="https://luma-brunch.es/">', f'<link rel="canonical" href="{url}">')
    rep('<meta property="og:url" content="https://luma-brunch.es/">', f'<meta property="og:url" content="{url}">')
    # alleen de Spaanse hoofdpagina verwijst door en heeft de Search Console-code
    s = re.sub(r'<script>/\*taal-doorverwijzing\*/.*?</script>\n?', '', s, count=1, flags=re.S)
    s = re.sub(r'<meta name="google-site-verification"[^>]*>\n', '', s, count=1)
    # paden één map dieper
    for a in ('src="home-assets/', 'href="home-assets/', 'href="favicon.ico"', 'href="apple-touch-icon.png"', 'href="tostada-options.css"'):
        s = s.replace(a, a.replace('="', '="../', 1))
    s = s.replace('href="carta/"', f'href="../carta/?lang={lang}"')
    # taalknoppen: juiste knop actief
    s = s.replace('aria-current="true" data-lang="es"', 'data-lang="es"')
    s = s.replace(f'hreflang="{lang}" lang="{lang}" data-lang="{lang}"', f'hreflang="{lang}" lang="{lang}" aria-current="true" data-lang="{lang}"')
    if 'lang="es" aria-current' in s or s.count('aria-current="true" data-lang') != 1: sys.exit('taalknop fout')
    out = ROOT / lang / 'index.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(s, encoding='utf8')
    # restcontrole: opvallende Spaanse woorden die zichtbaar zouden blijven
    body = re.sub(r'<script type="application/ld\+json">.*?</script>|<style>.*?</style>', '', s, flags=re.S)
    left = [w for w in ('Abierto', 'Cerrado', 'Horario', 'carta de Luma', 'Reseña', 'correo', 'Nombre', 'Visítanos', 'Lunes', 'Domingo', 'Escribir') if w in body]
    print(f'{lang}: {out.relative_to(ROOT)} ({len(s)//1024} KB)' + (f'  LET OP nog Spaans: {left}' if left else ''))

build('en', 1)
build('nl', 2)
