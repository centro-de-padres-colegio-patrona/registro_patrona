const { execSync } = require('child_process');

// Función para obtener el branch activo
function getGitBranch() {
  // 1. Intentar variable de entorno de Render
  if (process.env.RENDER_GIT_BRANCH) {
    return process.env.RENDER_GIT_BRANCH;
  }
  // 2. Intentar ejecutar comando local de git
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    return 'main'; // Fallback por defecto si no se detecta git
  }
}

const currentBranch = getGitBranch();
// Si la rama es 'main' o 'master', usa la URL base. De lo contrario, inyecta la rama.
const branchSubdomain = (currentBranch === 'produccion' )
  ? 'registro-patrona'
  : `registro-patrona-${currentBranch}`;

/*const BASEURL = (PORT === LOCAL_PORT)
  ? 'https://unhappily-correct-squeeze.ngrok-free.dev'
  : `https://${branchSubdomain}.onrender.com`;*/

const BASEURL = `https://${branchSubdomain}.onrender.com`;


module.exports.BASEURL = BASEURL;
