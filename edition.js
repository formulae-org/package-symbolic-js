/*
Fōrmulæ symbolic package. Module for edition.
Copyright (C) 2015-2025 Laurence R. Ugalde

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

export class Symbolic extends Formulae.Package {}

Symbolic.editionSymbol = function() {
	let s = "";
	do {
		s = prompt(Symbolic.messages.enterSymbol, s);
	}
	while (s == "");
	
	if (s == null) return;
	
	let newExpression = Formulae.createExpression("Symbolic.Symbol");
	newExpression.set("Name", s);

	Formulae.sExpression.replaceBy(newExpression);
	Formulae.sHandler.prepareDisplay();
	Formulae.sHandler.display();
	Formulae.setSelected(Formulae.sHandler, newExpression, false);
}

Symbolic.actionSymbol = {
	isAvailableNow: () => Formulae.sHandler.type != Formulae.ROW_OUTPUT,
	getDescription: () => "Change the name of the symbol...",
	doAction: () => {
		let s = Formulae.sExpression.get("Name");
		do {
			s = prompt(Symbolic.messages.updateSymbol, s);
		}
		while (s == "");
		
		if (s == null) return;
		
		Formulae.sExpression.set("Name", s);
		
		Formulae.sHandler.prepareDisplay();
		Formulae.sHandler.display();
		Formulae.setSelected(Formulae.sHandler, Formulae.sExpression, false);
	}
};

Symbolic.editionFunction = function() {
	let functionExpression = Formulae.createExpression("Symbolic.Function");
	Formulae.sExpression.replaceBy(functionExpression);

	functionExpression.addChild(Formulae.sExpression);

	let listExpression = Formulae.createExpression("List.List");
	functionExpression.addChild(listExpression);

	let nullExpression = Formulae.createExpression("Null");
	listExpression.addChild(nullExpression);
	
	Formulae.sHandler.prepareDisplay();
	Formulae.sHandler.display();
	Formulae.setSelected(Formulae.sHandler, nullExpression, false);
}

Symbolic.setEditions = function() {
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafSymbol,     Formulae.editionSymbol = () => Symbolic.editionSymbol());
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafAssignment, () => Expression.binaryEdition ("Symbolic.Assignment", false));
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafLocal,      () => Expression.wrapperEdition("Symbolic.Local"));
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafUndefine,   () => Expression.wrapperEdition("Symbolic.Undefine"));

	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafFunction, Formulae.editionFunction = () => Symbolic.editionFunction());
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafReturn,   () => Expression.wrapperEdition("Symbolic.Return"));

	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafLambda,            () => Expression.binaryEdition ("Symbolic.Lambda", false));
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafLambdaApplication, () => Expression.binaryEdition ("Symbolic.LambdaApplication", false));
	Formulae.addEdition(this.messages.pathSymbolic, null, this.messages.leafLambdaBuilder,     () => Expression.binaryEdition ("Symbolic.LambdaBuilder", false));
};

Symbolic.setActions = function() {
	Formulae.addAction("Symbolic.Symbol", Symbolic.actionSymbol);
};
