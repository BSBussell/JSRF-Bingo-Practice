
unbalanced = 1
# 1 is same chance for Shibuya/Kogane/Benten. 0 is same chance for each level.

simple_bingos = 1
# at most one graffiti per bingo

list_graffiti = 1 
# lists the graffiti squares


# raw_input() from python 2 is renamed to just input() in python 3
try:
	input = raw_input
except NameError:
	pass


# All the sqaure names sorted. Feel free to rename them.

Dogen = ["Dogen 005 - Isolated Platform down the hill",
	"Dogen 034 - Right of street",
	"Dogen 061 - Past Statue",
	"Dogen 092 - Grind x 10",
	"Dogen 117 - Air x 3",
	"Dogen 006 - Tricks x 20",
	"Dogen 035 - Points x 50k",
	"Dogen 062 - Special (Grind Avenue)"]

Shibuya = ["Shibuya 007 - On top of bus",
	"Shibuya 093 - Cubby",
	"Shibuya 119 - Platform",
	"Shibuya 036 - Grind x 10",
	"Shibuya 063 - Air x 3",
	"Shibuya 094 - Tricks x 25",
	"Shibuya 121 - Points x 100k",
	"Shibuya 008 - Special (13 platforms)"]

Chuo = ["Chuo 037 - Right Canal",
	"Chuo 064 - Cubby",
	"Chuo 095 - South of Hayashi",
	"Chuo 122 - Grind x 10",
	"Chuo 009 - Air x 4",
	"Chuo 038 - Tricks x 30",
	"Chuo 065 - Points x 60k",
	"Chuo 096 - Special (G/W to end)"]

RDH = ["RDH 010 - Top of station",
	"RDH 039 - Platform above Cops 2",
	"RDH 123 - Sauna",
	"RDH 067 - Grind x 10",
	"RDH 097 - Air x 4",
	"RDH 124 - Tricks x 35",
	"RDH 011 - Points x 40k",
	"RDH 040 - Special (Grind Lower Chimney)"]

_99th = ["99th 068 - Center of Dark",
	"99th 098 - Light Wallride",
	"99th 126 - Dark Wallride",
	"99th 012 - Grind x 15",
	"99th 041 - Air x 4",
	"99th 069 - Tricks x 40",
	"99th 099 - Points x 100k",
	"99th 127 - Special (Perimeter of Tower, E,S,W,N,E)"]

Sewers = ["Sewers 013 - Entrance",
	"Sewers 042 - Center Structure",
	"Sewers 070 - Rail, Floor 1 to 2",
	"Sewers 100 - Grind x 10",
	"Sewers 128 - Air x 4",
	"Sewers 015 - Tricks x 45",
	"Sewers 043 - Points x 100k",
	"Sewers 071 - Special (Points x 150k)"]

BP = ["Btm pt. 016 - Catwalk, PJ Room 3",
	"Btm pt. 101 - Catwalk, near Cube",
	"Btm pt. 129 - Right halfpipe after winding rails",
	"Btm pt. 044 - Grind x 10",
	"Btm pt. 072 - Air x 4",
	"Btm pt. 102 - Tricks x 50",
	"Btm pt. 130 - Points x 50k",
	"Btm pt. 017 - Special (Points x 70k)"]

Hikage = ["Hikage 045 - Cubby",
	"Hikage 073 - Crane",
	"Hikage 103 - Center, floating",
	"Hikage 131 - Grind x 20",
	"Hikage 018 - Air x 4",
	"Hikage 046 - Tricks x 55",
	"Hikage 074 - Points x 300k",
	"Hikage 104 - Special (Crane, Top, Bottom)"]

Kibo = ["Kibo 019 - Under tower",
	"Kibo 047 - Lower platform, under wires",
	"Kibo 132 - Upper platform at end",
	"Kibo 076 - Grind x 20",
	"Kibo 105 - Air x 4",
	"Kibo 133 - Tricks x 60",
	"Kibo 021 - Points x 250k",
	"Kibo 049 - Special (Walk under gate at top)"]

SDPP = ["SDPP 077 - Top of Observatory",
	"SDPP 106 - Floating, Pink Halfpipes",
	"SDPP 134 - Entrance Pillar",
	"SDPP 022 - Grind x 20",
	"SDPP 050 - Air x 4",
	"SDPP 079 - Tricks x 65",
	"SDPP 107 - Points x 110k",
	"SDPP 135 - Special (Circle the Pharaoh)"]

HWY0 = ["HWY0 023 - Directly under entrance",
	"HWY0 051 - Left alley near tall neon sign",
	"HWY0 080 - Trash Pit",
	"HWY0 108 - Grind x 15",
	"HWY0 136 - Air x 5",
	"HWY0 024 - Tricks x 70",
	"HWY0 052 - Points x 90k",
	"HWY0 081 - Special (Wallride alley)"]

Dino = ["Sky Dino 026 - On top of T-rex",
	"Sky Dino 054 - Under Brontosaurus",
	"Sky Dino 109 - Platform near starting spiral",
	"Sky Dino 137 - Platform under first swing",
	"Sky Dino 082 - Grind x 50",
	"Sky Dino 110 - Air x 6",
	"Sky Dino 138 - Tricks x 100",
	"Sky Dino 027 - Points x 10k",
	"Sky Dino 055 - Special (Rail, Swing, Rail)"]

FRZ = ["FRZ 083 - 'Clip' soul, lower area",
	"FRZ 111 - Middle of upper area, down tube",
	"FRZ 139 - Very top, End of first Maze",
	"FRZ 028 - Grind x 10",
	"FRZ 056 - Air x 8",
	"FRZ 084 - Tricks x 100",
	"FRZ 112 - Points x 50k",
	"FRZ 140 - Special (Grind up the metal)"]

Chars = ["RDH Unlock Rhyth",
	"Kibo Unlock Boogie",
	"HWY0 Unlock Soda",
	"Stadium Unlock Jazz",
	"Btm pt. Unlock Cube"]

Graffiti = ["Dogen Spray 100% GRAFFITI",
	"Shibuya Spray 100% GRAFFITI",
	"Chuo Spray 100% GRAFFITI",
	"RDH Spray 100% GRAFFITI",
	"99th Spray 100% GRAFFITI",
	"Sewers Spray 100% GRAFFITI",
	"Btm pt. Spray 100% GRAFFITI",
	"Hikage Spray 100% GRAFFITI",
	"Kibo Spray 100% GRAFFITI",
	"SDPP Spray 100% GRAFFITI",
	"HWY0 Spray 100% GRAFFITI",
	"Sky Dino Spray 100% GRAFFITI",
	"FRZ Spray 100% GRAFFITI"]

all_levels = [Dogen, Shibuya, Chuo, RDH, _99th, Sewers, BP, Hikage, Kibo, SDPP, HWY0, Dino, FRZ]

Souls = []
for level in all_levels:
	for soul in level:
		Souls.append(soul)

everything_in_one_list = Graffiti + Chars + Souls


import random
import sys
def Board_from_list_of_squares(list_of_squares,shuffle=1):
	Board = "["
	for i in range(25):
		if shuffle == 1:
			square = list_of_squares.pop(random.randrange(len(list_of_squares)))
		else:
			square = list_of_squares.pop(0)
		Board = Board + '{"name":"' + square + '"},'
	Board = Board[:-1] + "]"
	return Board


"""
total number of different squares = 123
With quackthingo, the probability of ...                           /0.863...
exactly 1 graffiti square = (13 C 1)*(110 C 24)/(123 C 25) = 0.165... -> 0.1915
exactly 2 graffiti square = (13 C 2)*(110 C 23)/(123 C 25) = 0.274... -> 0.3170
exactly 3 graffiti square = (13 C 3)*(110 C 22)/(123 C 25) = 0.262... -> 0.3038
exactly 4 graffiti square = (13 C 4)*(110 C 21)/(123 C 25) = 0.162... -> 0.1877
						       sum = 0.863... -> 1.0000
"""

def n_graffiti(n):
	if n == 0:
		return []
	elif n == -1:
		r = random.random()
		if r < 0.1915:
			number_of_graffiti = 1
		elif 0.1915 <= r < 0.5085:
			number_of_graffiti = 2
		elif 0.5085 <= r < 0.8123:
			number_of_graffiti = 3
		else:
			number_of_graffiti = 4
	else:
		number_of_graffiti = n

	if unbalanced == 1:
		shibuya_graffiti = ["Dogen Spray 100% GRAFFITI", "Shibuya Spray 100% GRAFFITI", "Chuo Spray 100% GRAFFITI", "Hikage Spray 100% GRAFFITI"]
		kogane_graffiti = ["RDH Spray 100% GRAFFITI", "Sewers Spray 100% GRAFFITI", "Btm pt. Spray 100% GRAFFITI", "Kibo Spray 100% GRAFFITI", "FRZ Spray 100% GRAFFITI"]
		benten_graffiti = ["99th Spray 100% GRAFFITI", "SDPP Spray 100% GRAFFITI", "HWY0 Spray 100% GRAFFITI", "Sky Dino Spray 100% GRAFFITI"]
		graffiti_list = []
		for i in range(number_of_graffiti):
			area = [shibuya_graffiti,kogane_graffiti,benten_graffiti][random.randrange(3)]
			g = area.pop(random.randrange(len(area)))
			graffiti_list.append(g)
		return graffiti_list
	else:
		graffiti_list = []
		for i in range(number_of_graffiti):
			g = Graffiti.pop(random.randrange(13-i))
			graffiti_list.append(g)
	return graffiti_list

def n_nongraffiti(n):
	if unbalanced == 1:
		Shibuya_cho = []
		Kogane = []
		Benten = []
		nongraffiti = Souls[:] + Chars[:]
		for square in nongraffiti:
			if square[:3] in ["Dog","Shi","Chu","Hik"]:
				Shibuya_cho.append(square)
			elif square[:3] in ["RDH","Sew","Btm","Kib","FRZ"]:
				Kogane.append(square)
			elif square[:3] in ["99t","Sta","SDP","Sky","HWY"]:
				Benten.append(square)
		squares = []
		for i in range(n):
			area = [Shibuya_cho,Kogane,Benten][random.randrange(3)]
			s = area.pop(random.randrange(len(area)))
			squares.append(s)

	else:
		nongraffiti = Souls[:] + Chars[:]
		squares = []
		for i in range(n):
			s = nongraffiti.pop(random.randrange(len(nongraffiti)))
			squares.append(s)
	return squares

def is_bingo_simple(squares):
	result = True
	rows_w_graf = []
	cols_w_graf = []
	tlbr = 0
	bltr = 0
	for i in range(25):
		if "GRAF" in squares[i]:
			row = int(i/5)
			col = i%5
			if row == col:
				tlbr += 1
			if row + col == 4:
				bltr += 1
			if row in rows_w_graf or col in cols_w_graf or tlbr>1 or bltr>1:
				result = False
			rows_w_graf.append(row)
			cols_w_graf.append(col)
	return result
				

def generate_normal_board(n=-1):
	graffiti = n_graffiti(n)
	nongraffiti = n_nongraffiti(25 - len(graffiti))
	squares = graffiti + nongraffiti
	if simple_bingos == 1:
		simple = False
		while simple == False:
			random.shuffle(squares)
			simple = is_bingo_simple(squares)
		board = Board_from_list_of_squares(squares,0)
	else:
		board = Board_from_list_of_squares(squares)
	return board


def generate_beginner_board():
	nongraffiti = Chars[:]
	for i in range(13):
		nongraffiti = nongraffiti + all_levels[i][:-1]
	easy_graffiti = [Graffiti[0],Graffiti[1],Graffiti[2],Graffiti[3],Graffiti[6],Graffiti[10]]
	squares = []
	number_of_graffiti = random.randrange(2)+1
	for i in range(number_of_graffiti):
		square = easy_graffiti.pop(random.randrange(6-i))
		squares.append(square)
	for i in range(25-number_of_graffiti):
		square = nongraffiti.pop(random.randrange(len(nongraffiti)))
		squares.append(square)
	return Board_from_list_of_squares(squares)

def generate_fast_board():
	defaults = []
	all_levels_ = all_levels[:]
	all_levels_[5] = all_levels_[5][:4]
	for i in range(13):
		for j in range(3):
			soul = all_levels_[i].pop(0)
			defaults.append(soul)
	soul = all_levels_[11].pop(0)
	defaults.append(soul)

	souls = []
	for level in all_levels_:
		for soul in level:
			souls.append(soul)

	squares = []
	for i in range(10):
		square = defaults.pop(random.randrange(len(defaults)))
		squares.append(square)
	souls = souls + defaults + Chars[:]
	fast_graffiti = [Graffiti[0],Graffiti[1],Graffiti[2],Graffiti[3],Graffiti[6],Graffiti[10],Graffiti[11]]
	number_of_graffiti = random.randrange(2)+1 - random.randrange(2) # 2-0=2, 2-1=1, 1-0=1, 1-1=0
	for i in range(number_of_graffiti):
		square = fast_graffiti.pop(random.randrange(7-i))
		squares.append(square)
	for i in range(25-number_of_graffiti):
		square = souls.pop(random.randrange(len(souls)))
		squares.append(square)
	return Board_from_list_of_squares(squares)

def generate_ch1to4():
	chars = ["Dogen Unlock Beat", "Shibuya Unlock Combo", "RDH Unlock Rhyth", "Sewers Unlock Garam", "Kibo Unlock Boogie"]
	souls = Souls[:80]
	graffiti = ["Dogen Spray Ch1 Graffiti","Shibuya Spray Ch1 Graffiti","Chuo Spray Ch2 Graffiti","RDH Spray Ch2 Graffiti","99th Spray Ch2 Graffiti","Hikage Spray Ch4 Graffiti","Kibo Spray Ch4 Graffiti","SDPP Spray Ch4 Graffiti"]
	list_of_squares = chars + souls + graffiti
	return Board_from_list_of_squares(list_of_squares)

def generate_axb(a,b,t=1):
	if t == 1:
		possible_squares = Souls[:] + Chars[:] + Graffiti[:]
	else:
		Shibuya_cho = []
		Kogane = []
		Ben10 = []
		for square in everything_in_one_list:
			if square[:3] in ["Dog","Shi","Chu","Hik"]:
				Shibuya_cho.append(square)
			elif square[:3] in ["RDH","Sew","Btm","Kib","FRZ"]:
				Kogane.append(square)
			elif square[:3] in ["99t","Sta","SDP","Sky","HWY"]:
				Ben10.append(square)
	if t == 2:
		possible_squares = Shibuya_cho

	elif t == 3:
		possible_squares = Kogane

	elif t == 4:
		possible_squares = Ben10

	elif t == 5:
		defaults = []
		all_levels_ = all_levels[:]
		for i in range(13):
			for j in range(3):
				soul = all_levels_[i].pop(0)
				defaults.append(soul)
		soul = all_levels_[11].pop(0)
		defaults.append(soul)
		possible_squares = defaults

	if a == 0:
		empty_rows = [0,1,2,3,4]
	elif a == 1:
		empty_rows = [0,1,3,4]
	elif a == 2:
		empty_rows = [0,3,4]
	elif a == 3:
		empty_rows = [0,4]
	elif a == 4:
		empty_rows = [4]
	elif a == 5:
		empty_rows = []
	if b == 0:
		empty_cols = [0,1,2,3,4]
	if b == 1:
		empty_cols = [0,1,3,4]
	elif b == 2:
		empty_cols = [0,3,4]
	elif b == 3:
		empty_cols = [0,4]
	elif b == 4:
		empty_cols = [4]
	elif b == 5:
		empty_cols = []

	squares = []

	for i in range(25):
		if int(i/5) in empty_rows or i%5 in empty_cols:
			squares.append(" ")
		else:
			square = possible_squares.pop(random.randrange(len(possible_squares)-i))
			squares.append(square)
	
	return Board_from_list_of_squares(squares,0)


if len(sys.argv) == 1:
	Board = generate_normal_board()

else:
	x = input("1: Normal board (1-4 graffiti)\n2: No graffiti\n3: Same chance for Shibuya/Kogane/Benten\n4: Beginner friendly (1 or 2 easy graffiti, no specials)\n5: Fast board (10+ defaults, 0-2 fast graffiti, only defaults and grind in Sewers)\n6: New game to chapter 4 (for non-lockout, first to 3 bingos)\n7: n graffiti squares\n8: a*b board\n")
	print("")
	if x == "1":
		Board = generate_normal_board()
	elif x == "2":
		Board = Board_from_list_of_squares(Souls+Chars)
	elif x == "3":
		unbalanced = 1; Board = generate_normal_board()
	elif x == "4":
		Board = generate_beginner_board()
	elif x == "5":
		Board = generate_fast_board()
	elif x == "6":
		Board = generate_ch1to4()
	elif x == "7":
		n = input("n: ")
		Board = generate_normal_board(int(n))
	elif x == "8":
		a = int(input("a: "))
		b = int(input("b: "))
		t = input("1: Vanilla\n2: Shibuya\n3: Kogane\n4: Benten\n5: defaults\n")
		if t == "":
			Board = generate_axb(a,b)
		else:
			Board = generate_axb(a,b,int(t))
try:
	import pyperclip
	pyperclip.copy(Board); print("Board added to clipboard")
except ModuleNotFoundError:
	print()
	print(Board)
	print()
	print('Type "pip install pyperclip" to get the board copied automatically')


def print_graffiti_in_board(Board):

	if "GRAFFITI" not in Board:
		print("Graffiti: None")
	else:
		graffiti_in_board = []
		Board_ = Board.split(" Spray 100")
		for i in range(len(Board_) - 1):
			graffiti_in_board.append(Board_[i].split('name":"')[-1])
		msg = "Graffiti: "
		for g in graffiti_in_board:
			msg = msg + str(g) + ", "
		print(msg[:-2])

if list_graffiti == 1:
	print_graffiti_in_board(Board)

