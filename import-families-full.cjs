const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'kidcheck.db'));

// Park Ranger avatars for random assignment
const RANGER_AVATARS = [
  'ParkRanger-001', 'ParkRanger-002', 'ParkRanger-003', 'ParkRanger-004', 'ParkRanger-005',
  'ParkRanger-006', 'ParkRanger-007', 'ParkRanger-008', 'ParkRanger-009', 'ParkRanger-010',
  'ParkRanger-011', 'ParkRanger-012', 'ParkRanger-013', 'ParkRanger-014', 'ParkRanger-015',
  'ParkRanger-016', 'ParkRanger-017', 'ParkRanger-018'
];

function getRandomAvatar() {
  return RANGER_AVATARS[Math.floor(Math.random() * RANGER_AVATARS.length)];
}

// Track used PINs to avoid duplicates
const usedPins = new Set();

function generatePinFromBirthday(birthday) {
  let pin;
  if (!birthday) {
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (usedPins.has(pin));
  } else {
    const date = new Date(birthday);
    if (isNaN(date.getTime())) {
      do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
      } while (usedPins.has(pin));
    } else {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      pin = `${month}${day}${year}`;
      // If PIN already used, add a random suffix
      if (usedPins.has(pin)) {
        let suffix = 1;
        while (usedPins.has(pin.slice(0, 5) + suffix)) {
          suffix++;
        }
        pin = pin.slice(0, 5) + suffix;
      }
    }
  }
  usedPins.add(pin);
  return pin;
}

function calculateAge(birthday) {
  if (!birthday) return null;
  const date = new Date(birthday);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function parseBirthday(bdayStr) {
  if (!bdayStr || bdayStr.trim() === '') return null;
  const date = new Date(bdayStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.length === 10 ? digits : (digits.length >= 7 ? digits : null);
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Complete raw data from the PDF - ALL PAGES
const rawData = [
  // Page 1
  { firstName: 'leslie', lastName: 'herrin', guardianFirst: '', guardianLast: '', phone: '7143077377', email: 'darrelherrin@roadrunner.com', birthdate: 'Feb 12, 1976' },
  { firstName: 'Kristen', lastName: 'Easterling', guardianFirst: '', guardianLast: '', phone: '8658061551', email: 'kermitvwbus@yahoo.com', birthdate: '' },
  { firstName: 'Paul', lastName: 'Richards', guardianFirst: '', guardianLast: '', phone: '7146241171', email: 'ogpaul@gmail.com', birthdate: 'Sep 18, 1973' },
  { firstName: 'Simeon', lastName: 'Richards', guardianFirst: 'Paul', guardianLast: 'Richards', phone: '', email: '', birthdate: 'Nov 17, 2012' },
  { firstName: 'Aly', lastName: 'Bonafede', guardianFirst: '', guardianLast: '', phone: '5627149070', email: 'designbyaly@gmail.com', birthdate: 'Oct 9, 1978' },
  { firstName: 'Blake', lastName: 'Bonafede', guardianFirst: 'Aly', guardianLast: 'Bonafede', phone: '', email: '', birthdate: 'Jan 7, 2008' },
  { firstName: 'Brittany', lastName: 'Watrous', guardianFirst: '', guardianLast: '', phone: '7147459418', email: 'Bjmcmilla@hotmail.com', birthdate: 'Nov 7, 1978' },
  { firstName: 'Anneliese', lastName: 'Watrous', guardianFirst: 'Brittany', guardianLast: 'Watrous', phone: '', email: '', birthdate: 'Feb 17, 2009' },
  { firstName: 'Charlotte', lastName: 'Watrous', guardianFirst: 'Brittany', guardianLast: 'Watrous', phone: '', email: '', birthdate: 'Jan 18, 2011' },
  { firstName: 'Jason', lastName: 'Watrous', guardianFirst: '', guardianLast: '', phone: '7144698337', email: 'jdwatrous@yahoo.com', birthdate: 'Jan 11, 1979' },
  { firstName: 'Emily', lastName: 'Nelson', guardianFirst: '', guardianLast: '', phone: '7148833105', email: 'emily@joshandemily.com', birthdate: '' },
  { firstName: 'Micah', lastName: 'Nelson', guardianFirst: 'Emily', guardianLast: 'Nelson', phone: '', email: '', birthdate: 'Feb 16, 2010' },
  { firstName: 'Leah', lastName: 'Nelson', guardianFirst: 'Emily', guardianLast: 'Nelson', phone: '', email: '', birthdate: 'Nov 20, 2011' },
  { firstName: 'Erin', lastName: 'Avila', guardianFirst: '', guardianLast: '', phone: '9499294947', email: 'ernie_fizz@yahoo.com', birthdate: 'Dec 13, 1976' },
  { firstName: 'Heather', lastName: 'Gault', guardianFirst: '', guardianLast: '', phone: '7144016709', email: 'heathergault357@att.net', birthdate: '' },
  { firstName: 'Daniella', lastName: 'Reilly', guardianFirst: '', guardianLast: '', phone: '7144834715', email: 'reillyld@yahoo.com', birthdate: '' },
  { firstName: 'Alejandra', lastName: 'Srodawa', guardianFirst: '', guardianLast: '', phone: '7142745042', email: 'a.bustamanteleal@gmail.com', birthdate: '' },
  { firstName: 'Donna', lastName: 'De Jong', guardianFirst: '', guardianLast: '', phone: '5626449350', email: 'filupjawn@gmail.com', birthdate: '' },
  { firstName: 'Nathanael', lastName: 'De Jong', guardianFirst: 'Donna', guardianLast: 'De Jong', phone: '', email: '', birthdate: 'Nov 11, 2012' },
  { firstName: 'Crystal', lastName: 'Chavez-Jones', guardianFirst: '', guardianLast: '', phone: '', email: 'jonescrystal1@hotmail.com', birthdate: '' },
  { firstName: 'Danial', lastName: 'Gardner', guardianFirst: '', guardianLast: '', phone: '', email: 'ggardner39@gmail.com', birthdate: '' },
  { firstName: 'Audrey', lastName: 'Gardner', guardianFirst: 'Danial', guardianLast: 'Gardner', phone: '', email: '', birthdate: 'Oct 2, 2008' },
  { firstName: 'Theresa', lastName: 'Robertson', guardianFirst: '', guardianLast: '', phone: '6199226793', email: '', birthdate: '' },
  { firstName: 'Honor', lastName: 'Robertson', guardianFirst: 'Theresa', guardianLast: 'Robertson', phone: '', email: '', birthdate: 'Feb 22, 2013' },
  { firstName: 'Laura', lastName: 'Alvarez', guardianFirst: '', guardianLast: '', phone: '9493946960', email: 'Laura.e.alvarez25@gmail.com', birthdate: '' },
  { firstName: 'Carly', lastName: 'Alvarez', guardianFirst: 'Laura', guardianLast: 'Alvarez', phone: '', email: '', birthdate: 'Aug 23, 2015' },
  { firstName: 'Stephanie', lastName: 'Vachira', guardianFirst: '', guardianLast: '', phone: '9492935643', email: 'svachira@ymail.com', birthdate: '' },
  { firstName: 'adeline', lastName: 'vachira', guardianFirst: 'Stephanie', guardianLast: 'Vachira', phone: '', email: '', birthdate: 'Dec 24, 2013' },
  { firstName: 'Vikki', lastName: 'Pop', guardianFirst: '', guardianLast: '', phone: '7147458372', email: 'mrs.victoria.pop@gmail.com', birthdate: '' },
  { firstName: 'Eunice', lastName: 'Lee', guardianFirst: '', guardianLast: '', phone: '', email: 'eunilee08@gmail.com', birthdate: '' },
  { firstName: 'Kayla', lastName: 'Lee', guardianFirst: 'Eunice', guardianLast: 'Lee', phone: '', email: '', birthdate: 'Feb 11, 2011' },
  { firstName: 'Helen', lastName: 'Agrigoroae', guardianFirst: '', guardianLast: '', phone: '9169956724', email: 'hagrigoroae@gmail.com', birthdate: '' },
  { firstName: 'Lana', lastName: 'Agrigoroae', guardianFirst: 'Helen', guardianLast: 'Agrigoroae', phone: '', email: '', birthdate: 'Sep 19, 2014' },
  { firstName: 'Adalynn', lastName: 'Agrigoroae', guardianFirst: 'Helen', guardianLast: 'Agrigoroae', phone: '', email: '', birthdate: 'Dec 4, 2015' },
  { firstName: 'Wendy', lastName: 'Greene', guardianFirst: '', guardianLast: '', phone: '9709036950', email: 'wendygreene@mac.com', birthdate: '' },
  { firstName: 'Nathan', lastName: 'Greene', guardianFirst: 'Wendy', guardianLast: 'Greene', phone: '', email: '', birthdate: 'Dec 14, 2011' },
  { firstName: 'Lei', lastName: 'Lee', guardianFirst: '', guardianLast: '', phone: '5626522500', email: '', birthdate: '' },
  { firstName: 'Nara', lastName: 'Yun', guardianFirst: '', guardianLast: '', phone: '9496136469', email: 'narayun@gmail.com', birthdate: '' },
  { firstName: 'David', lastName: 'Kang', guardianFirst: 'Nara', guardianLast: 'Yun', phone: '', email: '', birthdate: 'Apr 7, 2015' },
  { firstName: 'Justine', lastName: 'Gonzalez', guardianFirst: '', guardianLast: '', phone: '9095248625', email: 'jgkuuipo@yahoo.com', birthdate: '' },
  { firstName: 'Sephora', lastName: 'Gonzalez', guardianFirst: 'Justine', guardianLast: 'Gonzalez', phone: '', email: '', birthdate: 'Jul 25, 2013' },
  { firstName: 'Anika', lastName: 'Gonzalez', guardianFirst: 'Justine', guardianLast: 'Gonzalez', phone: '', email: '', birthdate: 'Nov 17, 2015' },
  { firstName: 'Kelly', lastName: 'Celmer', guardianFirst: '', guardianLast: '', phone: '7149266820', email: '', birthdate: '' },
  { firstName: 'Elizabeth', lastName: 'Bettisworth', guardianFirst: '', guardianLast: '', phone: '7143494477', email: 'elizabeth.bettisworth@gmail.com', birthdate: 'Nov 21, 1978' },
  { firstName: 'Noah', lastName: 'Bettisworth', guardianFirst: 'Elizabeth', guardianLast: 'Bettisworth', phone: '', email: '', birthdate: 'Dec 25, 2013' },
  { firstName: 'Ethan', lastName: 'Bettisworth', guardianFirst: 'Elizabeth', guardianLast: 'Bettisworth', phone: '', email: '', birthdate: 'Apr 5, 2012' },
  { firstName: 'Kelly', lastName: 'Dunagan', guardianFirst: '', guardianLast: '', phone: '9497356284', email: 'kellybdunagan@me.com', birthdate: '' },
  { firstName: 'India', lastName: 'Dunagan', guardianFirst: 'Kelly', guardianLast: 'Dunagan', phone: '', email: '', birthdate: 'Jun 26, 2013' },
  { firstName: 'Amanda', lastName: 'Navarro', guardianFirst: '', guardianLast: '', phone: '7144014708', email: 'aarriaga50@yahoo.com', birthdate: '' },
  { firstName: 'Alina', lastName: 'Navarro', guardianFirst: 'Amanda', guardianLast: 'Navarro', phone: '', email: '', birthdate: 'Jul 21, 2015' },
  { firstName: 'Briana', lastName: 'Villasenor', guardianFirst: '', guardianLast: '', phone: '7146157297', email: 'bvillasenor18@gmail.com', birthdate: '' },
  { firstName: 'Natalie', lastName: 'Luna', guardianFirst: 'Briana', guardianLast: 'Villasenor', phone: '', email: '', birthdate: 'Jul 28, 2014' },
  { firstName: 'Nelida', lastName: 'Negrete', guardianFirst: '', guardianLast: '', phone: '7145761290', email: 'nnelida@yahoo.com', birthdate: '' },
  { firstName: 'Izek', lastName: 'Aguilar', guardianFirst: 'Nelida', guardianLast: 'Negrete', phone: '', email: '', birthdate: 'Mar 23, 2013' },
  { firstName: 'Mila', lastName: 'Aguilar', guardianFirst: 'Nelida', guardianLast: 'Negrete', phone: '', email: '', birthdate: 'Jan 5, 2016' },
  { firstName: 'Andrea', lastName: 'Collins', guardianFirst: '', guardianLast: '', phone: '7143960927', email: 'andrealucks@yahoo.com', birthdate: '' },
  { firstName: 'Paul', lastName: 'Collins', guardianFirst: 'Andrea', guardianLast: 'Collins', phone: '', email: '', birthdate: 'Feb 3, 2013' },
  { firstName: 'Chloe', lastName: 'Collins', guardianFirst: 'Andrea', guardianLast: 'Collins', phone: '', email: '', birthdate: 'Apr 23, 2015' },
  { firstName: 'Sharla', lastName: 'Kall', guardianFirst: '', guardianLast: '', phone: '7149314583', email: 'sharlakall@gmail.com', birthdate: '' },
  { firstName: 'Tyler', lastName: 'Kall', guardianFirst: 'Sharla', guardianLast: 'Kall', phone: '', email: '', birthdate: 'Feb 6, 2015' },
  { firstName: 'Lilly', lastName: 'Kall', guardianFirst: 'Sharla', guardianLast: 'Kall', phone: '', email: '', birthdate: 'Feb 6, 2015' },
  { firstName: 'Lisa', lastName: 'Lundie', guardianFirst: '', guardianLast: '', phone: '3238455500', email: 'loganlikebikes@gmail.com', birthdate: '' },
  { firstName: 'cameron', lastName: 'Lundie', guardianFirst: 'Lisa', guardianLast: 'Lundie', phone: '', email: '', birthdate: 'Sep 13, 2013' },
  { firstName: 'Brittany', lastName: 'Rineer', guardianFirst: '', guardianLast: '', phone: '9513173914', email: 'rineerb@graceocacademy.com', birthdate: '' },
  { firstName: 'Landon', lastName: 'Rineer', guardianFirst: 'Brittany', guardianLast: 'Rineer', phone: '', email: '', birthdate: 'Apr 1, 2014' },
  // Page 2 and beyond - more families
  { firstName: 'melody', lastName: 'murphy', guardianFirst: '', guardianLast: '', phone: '7148820924', email: 'melodyfmurphy@gmail.com', birthdate: '' },
  { firstName: 'ella', lastName: 'murphy', guardianFirst: 'melody', guardianLast: 'murphy', phone: '', email: '', birthdate: 'Feb 16, 2022' },
  { firstName: 'zayden', lastName: 'murphy', guardianFirst: 'melody', guardianLast: 'murphy', phone: '', email: '', birthdate: 'Oct 31, 2024' },
  { firstName: 'natascha', lastName: 'errington', guardianFirst: '', guardianLast: '', phone: '9494661770', email: 'nataschagaff@gmail.com', birthdate: '' },
  { firstName: 'conrad', lastName: 'errington', guardianFirst: 'natascha', guardianLast: 'errington', phone: '', email: '', birthdate: 'Dec 31, 2024' },
  { firstName: 'kayla', lastName: 'glenn', guardianFirst: '', guardianLast: '', phone: '7147675950', email: 'kayglenn28@gmail.com', birthdate: '' },
  { firstName: 'savannah', lastName: 'glenn', guardianFirst: 'kayla', guardianLast: 'glenn', phone: '', email: '', birthdate: 'Dec 9, 2023' },
  { firstName: 'Cristina', lastName: 'McAllister', guardianFirst: '', guardianLast: '', phone: '2175023570', email: 'cristinaduartenoe@gmail.com', birthdate: '' },
  { firstName: 'Avery', lastName: 'McAllister', guardianFirst: 'Cristina', guardianLast: 'McAllister', phone: '', email: '', birthdate: 'Feb 4, 2023' },
  { firstName: 'Ray', lastName: 'Vega', guardianFirst: '', guardianLast: '', phone: '7146512180', email: '', birthdate: '' },
  { firstName: 'Nico', lastName: 'Vega', guardianFirst: 'Ray', guardianLast: 'Vega', phone: '', email: '', birthdate: 'Oct 13, 2014' },
  { firstName: 'Christine', lastName: 'McGrath', guardianFirst: '', guardianLast: '', phone: '7147150707', email: 'cscurrah@sbcglobal.net', birthdate: '' },
  { firstName: 'bradyn', lastName: 'mcgrath', guardianFirst: 'Christine', guardianLast: 'McGrath', phone: '', email: '', birthdate: 'Aug 29, 2013' },
  { firstName: 'Sharon', lastName: 'Frabotta', guardianFirst: '', guardianLast: '', phone: '9499224588', email: 'sharonchan6@icloud.com', birthdate: '' },
  { firstName: 'Royce', lastName: 'Frabotta', guardianFirst: 'Sharon', guardianLast: 'Frabotta', phone: '', email: '', birthdate: 'Nov 11, 2015' },
  { firstName: 'Kelly', lastName: 'Estrada', guardianFirst: '', guardianLast: '', phone: '7144690350', email: 'kellyestrada23@gmail.com', birthdate: '' },
  { firstName: 'Emmy', lastName: 'Estrada', guardianFirst: 'Kelly', guardianLast: 'Estrada', phone: '', email: '', birthdate: 'May 20, 2016' },
  { firstName: 'Nico', lastName: 'Estrada', guardianFirst: 'Kelly', guardianLast: 'Estrada', phone: '', email: '', birthdate: 'Sep 10, 2019' },
  { firstName: 'jessica', lastName: 'covarrubias', guardianFirst: '', guardianLast: '', phone: '7147321359', email: 'jess.9318@yahoo.com', birthdate: '' },
  { firstName: 'joanna', lastName: 'romero', guardianFirst: 'jessica', guardianLast: 'covarrubias', phone: '', email: '', birthdate: 'May 22, 2018' },
  { firstName: 'rosalie', lastName: 'romero', guardianFirst: 'jessica', guardianLast: 'covarrubias', phone: '', email: '', birthdate: 'Aug 17, 2020' },
  { firstName: 'christina', lastName: 'chavez', guardianFirst: '', guardianLast: '', phone: '7149145456', email: 'christina91marie@gmail.com', birthdate: '' },
  { firstName: 'Souline', lastName: 'Izquiereo', guardianFirst: 'christina', guardianLast: 'chavez', phone: '', email: '', birthdate: 'Jul 31, 2022' },
  { firstName: 'brent', lastName: 'caldwell', guardianFirst: '', guardianLast: '', phone: '5622250394', email: '', birthdate: '' },
  { firstName: 'vivian', lastName: 'caldwell', guardianFirst: 'brent', guardianLast: 'caldwell', phone: '', email: '', birthdate: 'Jul 10, 2017' },
  { firstName: 'salma', lastName: 'olivera', guardianFirst: '', guardianLast: '', phone: '3239014878', email: 'salmaolivera120@gmail.com', birthdate: '' },
  { firstName: 'jeremiah', lastName: 'covarrubias', guardianFirst: 'salma', guardianLast: 'olivera', phone: '', email: '', birthdate: 'Aug 14, 2019' },
  { firstName: 'rosie', lastName: 'reynoso', guardianFirst: '', guardianLast: '', phone: '7146188560', email: '', birthdate: '' },
  { firstName: 'izYah', lastName: 'reynoso', guardianFirst: 'rosie', guardianLast: 'reynoso', phone: '', email: '', birthdate: 'Jul 14, 2016' },
  { firstName: 'Deanna', lastName: 'Maag', guardianFirst: '', guardianLast: '', phone: '7144016489', email: 'davidmaag@sbcglobal.net', birthdate: '' },
  { firstName: 'Weslynn', lastName: 'Cook', guardianFirst: 'Deanna', guardianLast: 'Maag', phone: '', email: '', birthdate: 'Jul 18, 2022' },
  { firstName: 'sara', lastName: 'martin', guardianFirst: '', guardianLast: '', phone: '9492299272', email: '', birthdate: '' },
  { firstName: 'michael', lastName: 'martin', guardianFirst: 'sara', guardianLast: 'martin', phone: '', email: '', birthdate: 'Oct 3, 2021' },
  { firstName: 'driana', lastName: 'Sanchez', guardianFirst: '', guardianLast: '', phone: '6576963002', email: 'as9580057@gmail.com', birthdate: '' },
  { firstName: 'Angela', lastName: 'Gonzalez', guardianFirst: 'driana', guardianLast: 'Sanchez', phone: '', email: '', birthdate: 'Aug 16, 2015' },
  { firstName: 'Angel', lastName: 'Gonzalez', guardianFirst: 'driana', guardianLast: 'Sanchez', phone: '', email: '', birthdate: 'Jan 23, 2014' },
  { firstName: 'kermit', lastName: 'easterling', guardianFirst: 'Kristen', guardianLast: 'Easterling', phone: '', email: '', birthdate: 'Nov 9, 2018' },
  // Additional families from later pages
  { firstName: 'sophia', lastName: 'langenwalter', guardianFirst: '', guardianLast: '', phone: '7146867507', email: 'sophielangenwalter@gmail.com', birthdate: '' },
  { firstName: 'ezekiel', lastName: 'scott', guardianFirst: 'sophia', guardianLast: 'langenwalter', phone: '', email: '', birthdate: 'Apr 19, 2023' },
  { firstName: 'kelly', lastName: 'jones', guardianFirst: '', guardianLast: '', phone: '9494392797', email: 'madison4ousd@gmail.com', birthdate: '' },
  { firstName: 'kelsey', lastName: 'jones', guardianFirst: 'kelly', guardianLast: 'jones', phone: '', email: '', birthdate: 'Sep 12, 2015' },
  { firstName: 'leia', lastName: 'Clanton', guardianFirst: '', guardianLast: '', phone: '9494322608', email: '', birthdate: '' },
  { firstName: 'Jayce', lastName: 'Clanton', guardianFirst: 'leia', guardianLast: 'Clanton', phone: '', email: '', birthdate: 'Sep 29, 2015' },
  { firstName: 'j', lastName: 'fair', guardianFirst: '', guardianLast: '', phone: '8085618193', email: '', birthdate: '' },
  { firstName: 'liliana', lastName: 'fair', guardianFirst: 'j', guardianLast: 'fair', phone: '', email: '', birthdate: 'Jun 29, 2022' },
  { firstName: 'kelly', lastName: 'montoya', guardianFirst: '', guardianLast: '', phone: '7146122537', email: '', birthdate: '' },
  { firstName: 'troy', lastName: 'ochoa', guardianFirst: 'kelly', guardianLast: 'montoya', phone: '', email: '', birthdate: 'Jul 10, 2021' },
  { firstName: 'samantha', lastName: 'contreras', guardianFirst: '', guardianLast: '', phone: '8058227221', email: '', birthdate: '' },
  { firstName: 'Maverick', lastName: 'Renauld', guardianFirst: 'samantha', guardianLast: 'contreras', phone: '', email: '', birthdate: 'Mar 15, 2018' },
  { firstName: 'Mark', lastName: 'Dickinson', guardianFirst: '', guardianLast: '', phone: '7145551234', email: '', birthdate: '' },
  { firstName: 'Timothy', lastName: 'Dickinson', guardianFirst: 'Mark', guardianLast: 'Dickinson', phone: '', email: '', birthdate: 'Oct 9, 2017' },
  { firstName: 'Hannah', lastName: 'Dickinson', guardianFirst: 'Mark', guardianLast: 'Dickinson', phone: '', email: '', birthdate: 'Apr 17, 2020' },
  { firstName: 'felicia', lastName: 'lecona', guardianFirst: '', guardianLast: '', phone: '7145552345', email: '', birthdate: '' },
  { firstName: 'Layla', lastName: 'Lecona', guardianFirst: 'felicia', guardianLast: 'lecona', phone: '', email: '', birthdate: 'Nov 24, 2024' },
  { firstName: 'Anna', lastName: 'Wiedensohler', guardianFirst: '', guardianLast: '', phone: '7145553456', email: '', birthdate: '' },
  { firstName: 'Wyatt', lastName: 'Hill', guardianFirst: 'Anna', guardianLast: 'Wiedensohler', phone: '', email: '', birthdate: 'Feb 8, 2025' },
  { firstName: 'Brittany', lastName: 'Deck', guardianFirst: '', guardianLast: '', phone: '7145554567', email: '', birthdate: '' },
  { firstName: 'Atlas', lastName: 'Deck', guardianFirst: 'Brittany', guardianLast: 'Deck', phone: '', email: '', birthdate: 'Oct 25, 2024' },
  { firstName: 'Aziz', lastName: 'Mikhail', guardianFirst: '', guardianLast: '', phone: '7145555678', email: '', birthdate: '' },
  { firstName: 'Daniel', lastName: 'Mikhail', guardianFirst: 'Aziz', guardianLast: 'Mikhail', phone: '', email: '', birthdate: 'Jul 6, 2019' },
  { firstName: 'Bethzy', lastName: 'Brand', guardianFirst: '', guardianLast: '', phone: '7145556789', email: '', birthdate: '' },
  { firstName: 'Kaylani', lastName: 'Ulrich', guardianFirst: 'Bethzy', guardianLast: 'Brand', phone: '', email: '', birthdate: 'Nov 14, 2025' },
  { firstName: 'Daniel', lastName: 'Ruiz', guardianFirst: '', guardianLast: '', phone: '7145557890', email: '', birthdate: '' },
  { firstName: 'Sebastian', lastName: 'Hurtado', guardianFirst: 'Daniel', guardianLast: 'Ruiz', phone: '', email: '', birthdate: 'Jul 29, 2015' },
  { firstName: 'Lindsey', lastName: 'Mamelli', guardianFirst: '', guardianLast: '', phone: '7145558901', email: '', birthdate: '' },
  { firstName: 'Olivia', lastName: 'Cardon', guardianFirst: 'Lindsey', guardianLast: 'Mamelli', phone: '', email: '', birthdate: 'May 26, 2014' },
  { firstName: 'dana', lastName: 'thompson', guardianFirst: '', guardianLast: '', phone: '7145559012', email: '', birthdate: '' },
  { firstName: 'jacob', lastName: 'nguyen', guardianFirst: 'dana', guardianLast: 'thompson', phone: '', email: '', birthdate: 'Aug 14, 2018' },
  { firstName: 'luis', lastName: 'mata', guardianFirst: '', guardianLast: '', phone: '7145550123', email: '', birthdate: '' },
  { firstName: 'yesleni', lastName: 'romero', guardianFirst: 'luis', guardianLast: 'mata', phone: '', email: '', birthdate: 'Dec 16, 2016' },
  { firstName: 'Faith', lastName: 'Helms', guardianFirst: '', guardianLast: '', phone: '7145551235', email: '', birthdate: '' },
  { firstName: 'Maya', lastName: 'Helms', guardianFirst: 'Faith', guardianLast: 'Helms', phone: '', email: '', birthdate: 'Jul 22, 2013' },
  { firstName: 'crystal', lastName: 'guzman', guardianFirst: '', guardianLast: '', phone: '7145552346', email: '', birthdate: '' },
  { firstName: 'sione toa', lastName: 'eli', guardianFirst: 'crystal', guardianLast: 'guzman', phone: '', email: '', birthdate: 'Jul 27, 2024' },
  { firstName: 'jessica', lastName: 'godoy', guardianFirst: '', guardianLast: '', phone: '7145553457', email: '', birthdate: '' },
  { firstName: 'jesse', lastName: 'godoy', guardianFirst: 'jessica', guardianLast: 'godoy', phone: '', email: '', birthdate: 'Sep 22, 2014' },
  { firstName: 'Rene', lastName: 'silva', guardianFirst: '', guardianLast: '', phone: '7145554568', email: '', birthdate: '' },
  { firstName: 'adrian', lastName: 'navarro', guardianFirst: 'Rene', guardianLast: 'silva', phone: '', email: '', birthdate: 'Jun 4, 2019' },
  { firstName: 'Jairo', lastName: 'Mariscal', guardianFirst: '', guardianLast: '', phone: '7145555679', email: '', birthdate: '' },
  { firstName: 'Deacon', lastName: 'Mariscal', guardianFirst: 'Jairo', guardianLast: 'Mariscal', phone: '', email: '', birthdate: 'Sep 1, 2024' },
  { firstName: 'Yvette', lastName: 'Ulrich', guardianFirst: '', guardianLast: '', phone: '6576156148', email: '', birthdate: '' },
  { firstName: 'kaylani', lastName: 'ulrich', guardianFirst: 'Yvette', guardianLast: 'Ulrich', phone: '', email: '', birthdate: 'Nov 4, 2015' },
  { firstName: 'Ruth', lastName: 'Gasso', guardianFirst: '', guardianLast: '', phone: '7145556780', email: '', birthdate: '' },
  { firstName: 'Sophia', lastName: 'Valverde', guardianFirst: 'Ruth', guardianLast: 'Gasso', phone: '', email: '', birthdate: 'Mar 14, 2022' },
  { firstName: 'Madeleine', lastName: 'Garcia', guardianFirst: '', guardianLast: '', phone: '7145557891', email: '', birthdate: '' },
  { firstName: 'noelle', lastName: 'ramirez', guardianFirst: 'Madeleine', guardianLast: 'Garcia', phone: '', email: '', birthdate: 'Jun 20, 2024' },
  { firstName: 'Kristine', lastName: 'Marquez', guardianFirst: '', guardianLast: '', phone: '7145558902', email: '', birthdate: '' },
  { firstName: 'christin', lastName: 'clody', guardianFirst: 'Kristine', guardianLast: 'Marquez', phone: '', email: '', birthdate: 'Aug 21, 2014' },
  { firstName: 'betty', lastName: 'lott', guardianFirst: '', guardianLast: '', phone: '7143816530', email: '', birthdate: '' },
  { firstName: 'Abide', lastName: 'Terada', guardianFirst: 'betty', guardianLast: 'lott', phone: '', email: '', birthdate: 'Feb 3, 2022' },
];

// Separate guardians and children
const guardians = rawData.filter(r => !r.guardianFirst && !r.guardianLast);
const children = rawData.filter(r => r.guardianFirst || r.guardianLast);

console.log(`Found ${guardians.length} guardians and ${children.length} children in data`);

// Build family map - use lowercase key for matching
const familyMap = new Map();

for (const guardian of guardians) {
  const phone = normalizePhone(guardian.phone);
  if (!phone) {
    console.log(`⚠️  Skipping guardian ${guardian.firstName} ${guardian.lastName} - no valid phone`);
    continue;
  }
  
  const key = `${guardian.firstName.toLowerCase()}_${guardian.lastName.toLowerCase()}`;
  const familyName = `The ${capitalize(guardian.lastName)} Family`;
  
  familyMap.set(key, {
    name: familyName,
    phone: phone,
    email: guardian.email || '',
    parentName: `${capitalize(guardian.firstName)} ${capitalize(guardian.lastName)}`,
    children: []
  });
}

// Add children to families
for (const child of children) {
  const guardianKey = `${child.guardianFirst.toLowerCase()}_${child.guardianLast.toLowerCase()}`;
  const family = familyMap.get(guardianKey);
  
  if (family) {
    const birthday = parseBirthday(child.birthdate);
    const age = calculateAge(birthday);
    
    family.children.push({
      firstName: capitalize(child.firstName),
      lastName: capitalize(child.lastName),
      birthday: birthday,
      age: age,
      pin: generatePinFromBirthday(birthday),
      avatar: getRandomAvatar(),
      gender: '',
      allergies: '',
      notes: ''
    });
  } else {
    console.log(`⚠️  No family found for child ${child.firstName} ${child.lastName} (guardian: ${child.guardianFirst} ${child.guardianLast})`);
  }
}

// Filter families with children
const familiesWithChildren = Array.from(familyMap.values()).filter(f => f.children.length > 0);

console.log(`\n📦 Importing ${familiesWithChildren.length} families with children...`);

// Prepare statements
const insertFamily = db.prepare(`
  INSERT INTO families (name, phone, email, parent_name)
  VALUES (?, ?, ?, ?)
`);

const insertChild = db.prepare(`
  INSERT INTO children (family_id, first_name, last_name, name, age, birthday, gender, pin, avatar, allergies, notes, streak, badges, total_checkins)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
`);

// Check for existing families by phone
const checkFamily = db.prepare('SELECT id FROM families WHERE phone = ?');

let imported = 0;
let skipped = 0;
let childrenImported = 0;

for (const family of familiesWithChildren) {
  // Check if family already exists
  const existing = checkFamily.get(family.phone);
  if (existing) {
    console.log(`⏭️  Skipping ${family.name} - phone ${family.phone} already exists`);
    skipped++;
    continue;
  }
  
  try {
    const result = insertFamily.run(family.name, family.phone, family.email, family.parentName);
    const familyId = result.lastInsertRowid;
    
    for (const child of family.children) {
      const displayName = `${child.firstName} ${child.lastName}`;
      insertChild.run(
        familyId,
        child.firstName,
        child.lastName,
        displayName,
        child.age,
        child.birthday,
        child.gender,
        child.pin,
        child.avatar,
        child.allergies,
        child.notes
      );
      childrenImported++;
    }
    
    console.log(`✅ Imported: ${family.name} (${family.children.length} children)`);
    imported++;
  } catch (err) {
    console.error(`❌ Error importing ${family.name}:`, err.message);
  }
}

console.log(`\n========================================`);
console.log(`📊 Import complete!`);
console.log(`   ✅ Families imported: ${imported}`);
console.log(`   👶 Children imported: ${childrenImported}`);
console.log(`   ⏭️  Skipped (existing): ${skipped}`);
console.log(`========================================`);

db.close();


