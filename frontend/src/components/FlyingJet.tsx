const ASPECT_RATIO = 208 / 737; // altura / largura da imagem-fonte (a29-tucano.png)

/**
 * Indicador de "voo" reaproveitável: foto do A-29 Tucano (matrícula FAB da
 * esquadrilha, fundo removido), virada para a direita e animada num
 * deslocamento horizontal contínuo, simulando a aeronave atravessando a
 * tela. Usado tanto no flash de entrada do app (SplashScreen, ver
 * componente irmão) quanto, em tamanho reduzido, em processos pontuais de
 * atualização/pesquisa/envio de dados feitos pela aplicação (ex.:
 * DiagnosticsPage ao pesquisar, AuthorizedConfigurationsPage ao carregar um
 * PDF) - qualquer instância nova reaproveita o mesmo keyframe CSS.
 */
export default function FlyingJet({
  width = 220,
  trackHeight = 140,
  durationS = 4.5,
}: {
  width?: number;
  trackHeight?: number;
  durationS?: number;
}) {
  const height = width * ASPECT_RATIO;
  return (
    <div className="flying-jet-wrap" style={{ position: "relative", width: "min(92%, 900px)", height: trackHeight, overflow: "hidden" }}>
      <img
        src="/reference/a29-tucano.png"
        alt=""
        aria-hidden="true"
        className="flying-jet-img"
        style={{
          width, height,
          position: "absolute", top: "50%", marginTop: -height / 2,
          animationDuration: `${durationS}s`,
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.35))",
        }}
      />
      <style>{`
        .flying-jet-img {
          left: -30%;
          animation-name: flying-jet-fly;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes flying-jet-fly {
          0%   { left: -30%; }
          100% { left: 115%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .flying-jet-img { animation: none !important; left: 20% !important; }
        }
      `}</style>
    </div>
  );
}
