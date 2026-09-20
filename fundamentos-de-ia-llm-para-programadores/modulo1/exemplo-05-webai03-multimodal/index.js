import { View } from './views/view.js';
import { FormController } from './controllers/formController.js';

(async function main() {
    // Initialize services and view
    const view = new View();

    // Set current year
    view.setYear();

    // Initialize controller and setup event listeners
    const controller = new FormController(view);
    controller.setupEventListeners();

    console.log('Application initialized successfully');
})();
