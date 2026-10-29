from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from io import BytesIO
import base64
from pathlib import Path
fb=FontBuilder(1000,isTTF=True)
names=['.notdef','space']+[f'g{i}' for i in range(33,127)]
fb.setupGlyphOrder(names);fb.setupCharacterMap({i:('space' if i==32 else f'g{i}') for i in range(32,127)})
glyphs={}
for n in names:
 p=TTGlyphPen(None)
 if n!='space':
  p.moveTo((100,0));p.lineTo((600,0));p.lineTo((600,700));p.lineTo((100,700));p.closePath()
 glyphs[n]=p.glyph()
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics({n:(1400,0) for n in names});fb.setupHorizontalHeader(ascent=800,descent=-200)
fb.setupNameTable({'familyName':'PaperTrail Generated Fixture','styleName':'Regular','uniqueFontIdentifier':'PaperTrailGeneratedFixture1','fullName':'PaperTrail Generated Fixture','psName':'PaperTrailGeneratedFixture','version':'Version 1.0'})
fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200);fb.setupPost();fb.setupMaxp();fb.font['head'].created=fb.font['head'].modified=3400000000
fb.font.recalcTimestamp=False
out=['// Generated geometric glyphs for tests; no third-party or private font data.']
for flavor,label in [(None,'ttf'),('woff','woff'),('woff2','woff2')]:
 fb.font.flavor=flavor;b=BytesIO();fb.save(b)
 out.append(f"export const {label}Base64 = '{base64.b64encode(b.getvalue()).decode()}'")


# A CFF OpenType counterpart exercises the OTTO container path.
otf=FontBuilder(1000,isTTF=False)
otf.setupGlyphOrder(names)
otf.setupCharacterMap({i:('space' if i==32 else f'g{i}') for i in range(32,127)})
charstrings={}
for n in names:
 p=T2CharStringPen(1400,None)
 if n!='space':
  p.moveTo((100,0));p.lineTo((600,0));p.lineTo((600,700));p.lineTo((100,700));p.closePath()
 charstrings[n]=p.getCharString()
otf.setupCFF('PaperTrailGeneratedFixture', {'FullName':'PaperTrail Generated Fixture','FamilyName':'PaperTrail Generated Fixture','Weight':'Regular'}, charstrings,{})
otf.setupHorizontalMetrics({n:(1400,0) for n in names})
otf.setupHorizontalHeader(ascent=800,descent=-200)
otf.setupNameTable({'familyName':'PaperTrail Generated Fixture','styleName':'Regular','uniqueFontIdentifier':'PaperTrailGeneratedFixtureOTF1','fullName':'PaperTrail Generated Fixture','psName':'PaperTrailGeneratedFixture','version':'Version 1.0'})
otf.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
otf.setupPost();otf.setupMaxp()
otf.font['head'].created=otf.font['head'].modified=3400000000
otf.font.recalcTimestamp=False
b=BytesIO();otf.save(b)
out.append(f"export const otfBase64 = '{base64.b64encode(b.getvalue()).decode()}'")
Path(__file__).with_name('generated-font.ts').write_text('\n'.join(out)+'\n')
