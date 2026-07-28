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

// Función para obtener el último commit (Hash corto de 7 caracteres o Hash completo)
function getGitLastCommit(short = true) {
  // 1. Intentar variable de entorno de Render
  if (process.env.RENDER_GIT_COMMIT) {
    const commit = process.env.RENDER_GIT_COMMIT.trim();
    return short ? commit.substring(0, 7) : commit;
  }

  // 2. Intentar ejecutar comando local de git
  try {
    const command = short 
      ? 'git rev-parse --short HEAD' 
      : 'git rev-parse HEAD';
      
    return execSync(command).toString().trim();
  } catch (e) {
    return 'unknown'; // Fallback en caso de no estar en un entorno git
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
