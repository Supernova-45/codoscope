export function ProductIntro() {
  const jumpToAtlas = () => {
    document.getElementById('atlas-workspace')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <section className="product-hero" aria-labelledby="product-title">
        <div className="hero-copy">
          <span className="hero-kicker">A microscope for codon language models</span>
          <h2 id="product-title">
            Same protein.
            <br />
            Different biological dialect.
          </h2>
          <p>
            Codoscope shows what DeCodon expects at every position in a coding
            sequence. Change only the organism: the amino acid can stay fixed
            while the preferred synonymous codon moves.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-action" onClick={jumpToAtlas}>
              Explore the strongest shift
            </button>
            <a href="#examples" className="secondary-action">Choose an example</a>
          </div>
        </div>
        <div className="dialect-demo" aria-label="Illustration of synonymous codon choice">
          <div className="demo-protein">
            <span>protein</span>
            <strong>Arg</strong>
          </div>
          <div className="demo-branches" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="demo-codons">
            <div>
              <span>E. coli</span>
              <strong>CGG</strong>
            </div>
            <div>
              <span>B. subtilis</span>
              <strong>CGC</strong>
            </div>
          </div>
          <p>Same amino acid, different synonymous preference</p>
        </div>
      </section>

      <section className="primer-grid" aria-label="Biology primer">
        <article>
          <span className="primer-number">01</span>
          <h3>Read DNA in threes</h3>
          <p>A <dfn title="Three DNA bases that encode an amino acid or stop signal">codon</dfn> is a three-letter DNA word such as CGG.</p>
        </article>
        <article>
          <span className="primer-number">02</span>
          <h3>Many words, one meaning</h3>
          <p><dfn title="Different codons that encode the same amino acid">Synonymous codons</dfn> produce the same amino acid and protein sequence.</p>
        </article>
        <article>
          <span className="primer-number">03</span>
          <h3>Organisms have preferences</h3>
          <p>Species use synonyms at different rates. DeCodon learned part of that codon-usage dialect.</p>
        </article>
      </section>
    </>
  );
}
